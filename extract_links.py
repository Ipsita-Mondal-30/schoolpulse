import PyPDF2
import re

pdf_file = open('./data/Class-I-REOPENINGDAY-POINTS-21_20260517120306.pdf', 'rb')
reader = PyPDF2.PdfReader(pdf_file)

links = []

for page_num in range(len(reader.pages)):
    page = reader.pages[page_num]
    
    # Try to extract annotations (which contain links)
    if '/Annots' in page:
        annots = page['/Annots']
        for annot in annots:
            annot_obj = annot.get_object()
            if '/A' in annot_obj and '/URI' in annot_obj['/A']:
                links.append(annot_obj['/A']['/URI'])
                
    # Also just extract raw text to see if links are in plaintext
    text = page.extract_text()
    urls = re.findall(r'https?://[^\s]+', text)
    links.extend(urls)

print(f"Found {len(links)} links.")
for link in links[:10]:
    print(link)
