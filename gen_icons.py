"""Generate icon-192.png and icon-512.png using pure Python (no deps)."""
import struct, zlib, math

def write_png(filename, size):
    W = H = size
    # Background: #ff6b2b (orange)
    bg = (0xff, 0x6b, 0x2b)
    # Draw a white "D" shape — simplified: filled white circle inset 20%, text "DE" as simple pixel art
    # We'll draw: orange bg, white rounded rect inset, orange "DE" text drawn via thick lines

    # Build raw pixel data
    pixels = []
    cx, cy = W / 2, H / 2
    r_outer = W * 0.5       # full circle (mask)
    r_inner = W * 0.38      # white inner circle
    r_icon  = W * 0.22      # orange fork icon area

    for y in range(H):
        row = []
        for x in range(W):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            if dist > r_outer:
                # Transparent outside circle — use orange (for maskable)
                row += [*bg, 255]
            elif dist > r_inner:
                # Orange ring
                row += [*bg, 255]
            else:
                # White inner circle — draw simple "DE" fork/knife in orange
                # Normalize coords: -1..1
                nx = dx / r_inner
                ny = dy / r_inner
                # Draw a stylized fork shape (two vertical prongs)
                on_icon = False

                # Left prong (fork)
                if -0.45 < nx < -0.05 and -0.65 < ny < 0.65:
                    thick = 0.12
                    # stem
                    if abs(nx + 0.25) < thick * 0.5 and ny > -0.1:
                        on_icon = True
                    # top prong 1
                    if abs(nx + 0.37) < thick * 0.4 and -0.65 < ny < -0.1:
                        on_icon = True
                    # top prong 2
                    if abs(nx + 0.13) < thick * 0.4 and -0.65 < ny < -0.1:
                        on_icon = True

                # Right element (knife)
                if 0.05 < nx < 0.48 and -0.65 < ny < 0.65:
                    thick = 0.12
                    # blade / stem
                    if abs(nx - 0.27) < thick * 0.5:
                        on_icon = True
                    # knife tip widening
                    if -0.65 < ny < -0.2 and 0.12 < nx < 0.42:
                        # triangle shape
                        tip_w = (1 + ny / 0.65) * 0.15
                        if abs(nx - 0.27) < tip_w:
                            on_icon = True

                if on_icon:
                    row += [*bg, 255]
                else:
                    row += [255, 255, 255, 255]

        pixels.append(bytes(row))

    # Encode as PNG
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)  # 8-bit, RGB — wait, need RGBA
    # bit depth=8, color type=6 (RGBA)
    ihdr_data = struct.pack('>II', W, H) + bytes([8, 6, 0, 0, 0])
    ihdr = make_chunk(b'IHDR', ihdr_data)

    raw_rows = b''.join(b'\x00' + row for row in pixels)
    compressed = zlib.compress(raw_rows, 9)
    idat = make_chunk(b'IDAT', compressed)
    iend = make_chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(signature + ihdr + idat + iend)
    print(f"Written {filename} ({W}x{H})")

write_png('icon-192.png', 192)
write_png('icon-512.png', 512)
print("Done.")
