"""Expose the complete board already embedded behind a sample crop in the supplied rule PDF.
Research reproduction only; original PDF is untouched. Requires PyMuPDF.
"""
from pathlib import Path
import fitz
root=Path(__file__).resolve().parent
p=fitz.open(root/'ITB-Rules-public.pdf')
resources=p.xref_get_key(p[0].xref,'Resources')[1]
s=p[0].read_contents()
s=s.replace(b'1359.54 199.384 130.243 129.56 re W n',b'1350 190 530 530 re W n')
s=s[:s.find(b'EMC',s.find(b'/Fm44 Do'))]+b' Q'
page=p.new_page(width=2100,height=722.315)
p.xref_set_key(page.xref,'Resources',resources)
xref=p.get_new_xref();p.update_object(xref,'<<>>');p.update_stream(xref,s);page.set_contents(xref)
page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(1350,10,1870,530)).save(root/'board-verified.png')
