from PIL import Image

def add_margin_to_make_square(image_path, output_path, color=(255, 255, 255, 0)):
    img = Image.open(image_path)
    width, height = img.size

    if width == height:
        img.save(output_path)
        return

    size = max(width, height)
    delta = size - height
    top_margin = delta // 2
    bottom_margin = delta - top_margin

    if img.mode in ('RGBA', 'LA'):
        new_img = Image.new("RGBA", (size, size), color)
    else:
        new_img = Image.new("RGB", (size, size), color[:3])

    new_img.paste(img, (0, top_margin))

    new_img.save(output_path)

add_margin_to_make_square("input.png", "output.png", color=(255, 255, 255, 0))