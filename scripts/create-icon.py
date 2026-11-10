"""Rebuild the original club/gavel app icon. Requires Pillow; not needed to build the app."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

scale = 2
size = 1024 * scale
image = Image.new("RGBA", (size, size))
mask = Image.new("L", (size, size))
d = ImageDraw.Draw(mask)
d.rounded_rectangle((72*scale, 72*scale, 952*scale, 952*scale), 190*scale, fill=255)
surface = Image.new("RGBA", (size, size))
pixels = surface.load()
for y in range(size):
    for x in range(size):
        light = max(0, 1 - ((x-size*.35)**2+(y-size*.25)**2)**.5 / size)
        pixels[x, y] = (int(5+13*light), int(30+35*light), int(26+28*light), 255)
image.paste(surface, (0, 0), mask)
d = ImageDraw.Draw(image)
gold = (201, 165, 92)
cream = (244, 221, 167)
def box(coords, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(tuple(int(v*scale) for v in coords), radius*scale,
                        fill=fill, outline=outline, width=width*scale)
box((110,110,914,914), 155, outline=gold, width=4)
box((130,130,894,894), 139, outline=(72,92,66), width=2)
# The raised auction hammer and its brass striking block.
hammer = Image.new("RGBA", (size, size))
h = ImageDraw.Draw(hammer)
h.rounded_rectangle((480*scale,310*scale,540*scale,720*scale),18*scale,fill=gold)
h.rounded_rectangle((365*scale,285*scale,655*scale,425*scale),26*scale,fill=gold)
h.rounded_rectangle((390*scale,301*scale,630*scale,323*scale),8*scale,fill=cream)
for x in (365, 620):
    h.rounded_rectangle((x*scale,278*scale,(x+35)*scale,432*scale),8*scale,fill=cream)
hammer = hammer.rotate(-36, resample=Image.Resampling.BICUBIC, center=(512*scale,480*scale))
shadow = Image.new("RGBA", (size,size), (0,0,0,0))
shadow.paste((0,0,0,150), (20*scale,24*scale,size+20*scale,size+24*scale), hammer.getchannel("A"))
image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12*scale)))
image.alpha_composite(hammer)
d = ImageDraw.Draw(image)
box((330,752,694,792), 14, fill=gold)
box((300,790,724,818), 9, fill=cream)
for x in (244, 780):
    d.polygon([(x*scale,510*scale),((x+12)*scale,530*scale),(x*scale,550*scale),((x-12)*scale,530*scale)],fill=gold)
out=Path(__file__).resolve().parents[1]/"resources"/"icon.png"
out.parent.mkdir(exist_ok=True)
image.resize((1024,1024),Image.Resampling.LANCZOS).save(out)
