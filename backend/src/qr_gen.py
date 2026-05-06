#!/usr/bin/env python3
import sys
import qrcode
import base64
from io import BytesIO

url = sys.argv[1]
qr = qrcode.QRCode(version=1, box_size=3, border=2)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(fill_color="#7c3aed", back_color="white")
buf = BytesIO()
img.save(buf, format='PNG')
print(base64.b64encode(buf.getvalue()).decode())
