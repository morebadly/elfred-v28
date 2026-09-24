import sys, json, io, zipfile, xml.etree.ElementTree as ET
payload=json.load(sys.stdin)
import base64
data=base64.b64decode(payload['base64'])
result=[]
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    files=archive.infolist()
    if sum(item.file_size for item in files)>30000000 or len(files)>3000: raise ValueError('expanded document too large')
    names=[item.filename for item in files if item.filename=='word/document.xml' or (item.filename.startswith('ppt/slides/slide') and item.filename.endswith('.xml')) or item.filename=='xl/sharedStrings.xml' or (item.filename.startswith('xl/worksheets/sheet') and item.filename.endswith('.xml'))]
    shared=[]
    if 'xl/sharedStrings.xml' in archive.namelist():
        root=ET.fromstring(archive.read('xl/sharedStrings.xml'))
        shared=[''.join(e.text or '' for e in item.iter() if e.tag.rsplit('}',1)[-1]=='t') for item in root]
    for name in sorted(names):
        if name=='xl/sharedStrings.xml': continue
        root=ET.fromstring(archive.read(name))
        if name.startswith('xl/worksheets/'):
            values=[]
            for cell in root.iter():
                if cell.tag.rsplit('}',1)[-1]!='c': continue
                parts=[e.text or '' for e in cell.iter() if e.tag.rsplit('}',1)[-1] in ['v','t']]
                value=' '.join(parts)
                if cell.attrib.get('t')=='s' and value.isdigit(): value=shared[int(value)] if int(value)<len(shared) else ''
                values.append(cell.attrib.get('r','')+': '+value)
        else:
            values=[element.text for element in root.iter() if element.tag.rsplit('}',1)[-1]=='t' and element.text]
        result.append(name+'\n'+'\n'.join(values))
print(json.dumps({'content':'\n\n'.join(result)[:500000]},ensure_ascii=False))
