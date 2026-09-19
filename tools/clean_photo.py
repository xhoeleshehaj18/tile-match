"""Rewrites a JPEG at most 1600px with no metadata: applies the EXIF rotation to the pixels, then drops EXIF
(GPS location, camera, dates), XMP and comments. Only the colour profile is kept."""
import sys
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
img.thumbnail((1600, 1600), Image.LANCZOS)  # shrink large photos; never enlarge small ones
icc = img.info.get("icc_profile")
img.save(dst, "JPEG", quality=82, optimize=True, progressive=True, **({"icc_profile": icc} if icc else {}))
