import os
from PIL import Image

src_dir = r"g:\Company\Personal\Forecom\CRM\logos"
public_dir = r"g:\Company\Personal\Forecom\CRM\VEYRA\public"
brand_dir = os.path.join(public_dir, "brand")
os.makedirs(brand_dir, exist_ok=True)

def crop_with_padding(img, bg_color, tolerance=15, pad_pct=0.03):
    # Determine bounding box
    img_rgba = img.convert("RGBA")
    w, h = img.size
    pixels = img_rgba.load()

    min_x, min_y, max_x, max_y = w, h, 0, 0
    bg_r, bg_g, bg_b = bg_color[:3]

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10:
                diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
                if diff > tolerance:
                    if x < min_x: min_x = x
                    if x > max_x: max_x = x
                    if y < min_y: min_y = y
                    if y > max_y: max_y = y

    if min_x > max_x or min_y > max_y:
        return img

    content_w = max_x - min_x + 1
    content_h = max_y - min_y + 1
    pad_x = int(content_w * pad_pct)
    pad_y = int(content_h * pad_pct)

    crop_x1 = max(0, min_x - pad_x)
    crop_y1 = max(0, min_y - pad_y)
    crop_x2 = min(w, max_x + 1 + pad_x)
    crop_y2 = min(h, max_y + 1 + pad_y)

    return img.crop((crop_x1, crop_y1, crop_x2, crop_y2))

print("Processing veyra-logo-full.png...")
img_full = Image.open(os.path.join(src_dir, "Veyra Ribbon Logo Identity.png"))
# Light background
cropped_full = crop_with_padding(img_full, bg_color=(254, 253, 255), tolerance=20, pad_pct=0.02)
cropped_full.save(os.path.join(brand_dir, "veyra-logo-full.png"), format="PNG", optimize=True)
print(f"Saved veyra-logo-full.png: size={cropped_full.size}")

print("Processing veyra-logo-full-dark.png...")
img_dark = Image.open(os.path.join(src_dir, "Veyra_ Simplify, Connect, Grow.png"))
# Dark navy background
cropped_dark = crop_with_padding(img_dark, bg_color=(3, 24, 48), tolerance=25, pad_pct=0.03)
cropped_dark.save(os.path.join(brand_dir, "veyra-logo-full-dark.png"), format="PNG", optimize=True)
print(f"Saved veyra-logo-full-dark.png: size={cropped_dark.size}")

print("Processing veyra-logo.png...")
img_logo = Image.open(os.path.join(src_dir, "Glossy Blue Veyra Tech Logo.png"))
# Light background without tagline
cropped_logo = crop_with_padding(img_logo, bg_color=(253, 253, 253), tolerance=20, pad_pct=0.02)
cropped_logo.save(os.path.join(brand_dir, "veyra-logo.png"), format="PNG", optimize=True)
print(f"Saved veyra-logo.png: size={cropped_logo.size}")

print("Processing veyra-logo-mark.png...")
img_mark = Image.open(os.path.join(src_dir, "Glossy Blue-Turquoise Ribbon V Logo.png"))
# Light background mark
cropped_mark = crop_with_padding(img_mark, bg_color=(253, 253, 253), tolerance=20, pad_pct=0.02)
cropped_mark.save(os.path.join(brand_dir, "veyra-logo-mark.png"), format="PNG", optimize=True)
print(f"Saved veyra-logo-mark.png: size={cropped_mark.size}")

print("Processing icon-192.png and icon-512.png...")
app_icon_src = Image.open(os.path.join(src_dir, "Glossy Blue V App Icon.png"))
# App icon has RGBA transparency outside the squircle
icon_192 = app_icon_src.resize((192, 192), Image.Resampling.LANCZOS)
icon_192.save(os.path.join(public_dir, "icon-192.png"), format="PNG", optimize=True)
print("Saved icon-192.png: size=(192, 192)")

icon_512 = app_icon_src.resize((512, 512), Image.Resampling.LANCZOS)
icon_512.save(os.path.join(public_dir, "icon-512.png"), format="PNG", optimize=True)
print("Saved icon-512.png: size=(512, 512)")

print("Processing favicon.ico...")
# Save valid multi-size ICO: 16x16, 32x32, 48x48, 64x64
fav_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
favicon_path = os.path.join(public_dir, "favicon.ico")
app_icon_src.save(favicon_path, format="ICO", sizes=fav_sizes)
print("Saved public/favicon.ico")

# Also copy to src/app/favicon.ico for Next.js App Router metadata
app_fav_path = r"g:\Company\Personal\Forecom\CRM\VEYRA\src\app\favicon.ico"
app_icon_src.save(app_fav_path, format="ICO", sizes=fav_sizes)
print("Saved src/app/favicon.ico")

print("All brand assets successfully generated!")
