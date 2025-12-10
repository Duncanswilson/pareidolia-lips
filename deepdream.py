import torch
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as T

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- load models ---
vgg = models.vgg16(weights=models.VGG16_Weights.IMAGENET1K_V1).to(device).eval()
goog = models.googlenet(weights=models.GoogLeNet_Weights.IMAGENET1K_V1).to(device).eval()

vgg_feats = vgg.features
goog_modules = dict(goog.named_modules())

# --- your image (already loaded?) ---
# if not:
# from PIL import Image
# img = Image.open("/content/balloon.jpg").convert("RGB")
# prep = T.Compose([
#     T.Resize(512),
#     T.ToTensor(),
#     T.Normalize(mean=[0.485,0.456,0.406],
#                 std=[0.229,0.224,0.225]),
# ])
# input_img = prep(img).unsqueeze(0).to(device)

def deprocess(t):
    t = t.detach().cpu().squeeze()
    t = t * torch.tensor([0.229, 0.224, 0.225]).view(3,1,1)
    t = t + torch.tensor([0.485, 0.456, 0.406]).view(3,1,1)
    t = t.clamp(0,1)
    return T.ToPILImage()(t)

def gaussian_blur(t, sigma=1.5):
    """Apply Gaussian blur to tensor for noise reduction."""
    kernel_size = int(6 * sigma + 1) | 1  # ensure odd
    channels = t.shape[1]
    # Create 1D Gaussian kernel
    x = torch.arange(kernel_size, device=t.device) - kernel_size // 2
    kernel_1d = torch.exp(-x**2 / (2 * sigma**2))
    kernel_1d = kernel_1d / kernel_1d.sum()
    # Apply separable convolution
    t = F.conv2d(t, kernel_1d.view(1, 1, -1, 1).expand(channels, 1, -1, 1), 
                 padding=(kernel_size//2, 0), groups=channels)
    t = F.conv2d(t, kernel_1d.view(1, 1, 1, -1).expand(channels, 1, 1, -1),
                 padding=(0, kernel_size//2), groups=channels)
    return t

# ---- CONFIG: blend vgg channel + goog eye channel ----
VGG_TARGETS = [
    # (layer_idx, [channels], weight)
    (24, [112], 1.0),   # change this to the facey one you found
]
GOOG_TARGETS = [
    ("inception4c.branch4.0", [32], 0.4),  # your nice eyes, lower weight
]

# register goog hook
goog_acts = {}
def make_goog_hook(name):
    def hook(m, inp, out):
        goog_acts[name] = out
    return hook

for name, chs, w in GOOG_TARGETS:
    goog_modules[name].register_forward_hook(make_goog_hook(name))

def dream_step_blend(img, step_size=0.03):
    img.requires_grad_(True)
    goog_acts.clear()

    # VGG forward up to max layer we need
    max_vgg_layer = max(l for (l, _, _) in VGG_TARGETS)
    x = img
    vgg_layer_outs = {}
    for i in range(max_vgg_layer+1):
        x = vgg_feats[i](x)
        vgg_layer_outs[i] = x

    # Goog forward once
    goog(img)

    total_loss = 0.0

    # VGG losses
    for (li, chs, w) in VGG_TARGETS:
        feat = vgg_layer_outs[li]
        for ch in chs:
            ch = min(ch, feat.shape[1]-1)
            total_loss = total_loss + w * feat[:, ch:ch+1].norm()

    # Goog losses
    for (name, chs, w) in GOOG_TARGETS:
        feat = goog_acts[name]
        if isinstance(feat, (tuple, list)):
            feat = feat[0]
        for ch in chs:
            ch = min(ch, feat.shape[1]-1)
            total_loss = total_loss + w * feat[:, ch:ch+1].norm()

    total_loss.backward(retain_graph=True)
    grad = img.grad
    with torch.no_grad():
        grad = gaussian_blur(grad, sigma=1.5)
        img = img + step_size * grad / (grad.std() + 1e-8)
    img = img.detach()
    return img, float(total_loss.detach().cpu())

def dream_octaves(img, num_steps=25, step_size=0.03,
                  num_octaves=3, octave_scale=1.4):
    octs = []
    for i in range(num_octaves):
        scale = octave_scale ** (-i)
        h = int(img.shape[-2] * scale)
        w = int(img.shape[-1] * scale)
        octs.append(F.interpolate(img, size=(h,w), mode='bilinear', align_corners=False))

    detail = torch.zeros_like(octs[-1])
    out_img = None

    for oi in reversed(range(num_octaves)):
        cur = (octs[oi] + detail).detach()
        for s in range(num_steps):
            cur, loss_val = dream_step_blend(cur, step_size=step_size)
            if (s+1) % 10 == 0:
                print(f"octave {oi}, step {s+1}/{num_steps}, loss={loss_val:.2f}")
        if oi == 0:
            out_img = cur
        else:
            up = F.interpolate(cur, size=octs[oi-1].shape[-2:], mode='bilinear', align_corners=False)
            up_base = F.interpolate(octs[oi], size=octs[oi-1].shape[-2:], mode='bilinear', align_corners=False)
            detail = (up - up_base).detach()

    return out_img

OUT = dream_octaves(input_img.to(device),
                    num_steps=50,
                    step_size=0.03,
                    num_octaves=3,
                    octave_scale=1.4)

deprocess(OUT)