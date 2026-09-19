import json, sys, re
from html.parser import HTMLParser
from urllib.parse import urljoin
class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack=[]; self.texts={'body':[], 'main':[], 'article':[]}; self.title=[]; self.audio=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); self.stack.append(tag)
        if tag in ['script','style','noscript','svg','nav','footer','header','aside','form','button','iframe']: self.skip+=1
        if tag in ['audio','source','a']:
            link=attrs.get('src') or attrs.get('href') or ''
            if link and (tag in ['audio','source'] or re.search(r'\.(mp3|wav|m4a|ogg|webm|flac|aac)(\?|$)',link,re.I)):
                self.audio.append(urljoin(sys.argv[2],link))
        if tag in ['p','br','div','section','h1','h2','h3','li'] and not self.skip:
            for k in self.texts:
                if k=='body' or k in self.stack:self.texts[k].append('\n')
        if tag in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.pop()
    def handle_endtag(self,tag):
        if tag in self.stack:
            while self.stack:
                t=self.stack.pop()
                if t in ['script','style','noscript','svg','nav','footer','header','aside','form','button','iframe']:self.skip=max(0,self.skip-1)
                if t==tag:break
        if tag in ['p','div','section','h1','h2','h3','li'] and not self.skip:
            for k in self.texts:
                if k=='body' or k in self.stack:self.texts[k].append('\n')
    def handle_data(self,data):
        if 'title' in self.stack:self.title.append(data)
        if not self.skip and 'title' not in self.stack:
            for k in self.texts:
                if k=='body' or k in self.stack:self.texts[k].append(data)
p=Extractor();p.feed(open(sys.argv[1],encoding='utf-8',errors='replace').read())
def clean(parts):return '\n\n'.join(x.strip() for x in re.sub(r'[ \t\r\f\v]+',' ',''.join(parts)).split('\n') if x.strip())
content=''
for key in ['article','main','body']:
    candidate=clean(p.texts[key])
    if len(candidate)>150:content=candidate;break
if len(content)<150:raise ValueError('No readable article: page may require login or JavaScript')
if len(content)>200000:raise ValueError('Article too long')
print(json.dumps({'title':''.join(p.title).strip()[:200] or '网页阅读材料','content':content,'audioLinks':list(dict.fromkeys(p.audio))[:12]},ensure_ascii=False))
