"""Generate the ArchinthAI logo as a PNG using Pillow."""

from PIL import Image, ImageDraw

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square background
bg_grad_top = (111, 155, 109)
bg_grad_bottom = (167, 190, 143)
radius = 112
# Draw background with vertical gradient
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(bg_grad_top[0] + (bg_grad_bottom[0] - bg_grad_top[0]) * t)
    g = int(bg_grad_top[1] + (bg_grad_bottom[1] - bg_grad_top[1]) * t)
    b = int(bg_grad_top[2] + (bg_grad_bottom[2] - bg_grad_top[2]) * t)
    d.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

# Mask for rounded corners
mask = Image.new("L", (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([16, 16, SIZE - 16, SIZE - 16], radius=radius, fill=255)
img.putalpha(mask)

# Inner ring
d = ImageDraw.Draw(img)
ring_color = (255, 255, 255, 70)
d.rounded_rectangle([52, 52, SIZE - 52, SIZE - 52], radius=80, outline=ring_color, width=3)

# Apex / roof triangle
apex = [(136, 214), (256, 138), (376, 214)]
roof_color = (244, 241, 232, 255)
d.polygon(apex, fill=roof_color)

# Left tower
d.rounded_rectangle([150, 210, 196, 360], radius=8, fill=(231, 239, 225, 255))
# Right tower
d.rounded_rectangle([316, 210, 362, 360], radius=8, fill=(231, 239, 225, 255))

# Crossbar / floor plates
d.rounded_rectangle([150, 258, 362, 272], radius=7, fill=(255, 255, 255, 230))
d.rounded_rectangle([150, 300, 362, 314], radius=7, fill=(255, 255, 255, 230))

# Windows on towers
win_color = (111, 155, 109, 255)
d.rounded_rectangle([162, 276, 184, 290], radius=4, fill=win_color)
d.rounded_rectangle([162, 318, 184, 332], radius=4, fill=win_color)
d.rounded_rectangle([328, 276, 350, 290], radius=4, fill=win_color)
d.rounded_rectangle([328, 318, 350, 332], radius=4, fill=win_color)

# Ground line
d.rounded_rectangle([120, 360, 392, 368], radius=4, fill=(255, 255, 255, 180))

img.save("static/img/archinthai-logo.png", "PNG")
print("Logo saved to static/img/archinthai-logo.png")
