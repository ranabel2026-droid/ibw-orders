# Generates html[dir=ltr] overrides mirroring physical left/right declarations.
import re,sys
def swap(w): return w.replace('left','\0').replace('right','left').replace('\0','right')
def rules(css):
    out=[];i=0
    for m in re.finditer(r'(@media[^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}|([^{}@]+)\{([^{}]*)\}',css):
        if m.group(1):
            inner=rules(m.group(2))
            if inner: out.append(m.group(1)+'{'+''.join(inner)+'}')
        else:
            sel,body=m.group(3).strip(),m.group(4)
            decls=[d.split(':',1) for d in body.split(';') if ':' in d]
            props={p.strip():v.strip() for p,v in decls}
            o=[]
            for p,v in props.items():
                if re.search(r'(^|-)(left|right)($|-)',p) and 'radius' not in p:
                    q=swap(p);o.append(f'{q}:{v}')
                    if q in props:o.append(f'{p}:{props[q]}')
                    elif v=='auto' and p.startswith('margin'):o.append(f'{p}:0')
                    elif p in('left','right'):o.append(f'{p}:auto')
                elif p in('padding','margin') and len(v.split())==4:
                    a,b,c,d=v.split();o.append(f'{p}:{a} {d} {c} {b}')
                elif p=='border-radius' and len(v.split())==4 and '/' not in v:
                    a,b,c,d=v.split();o.append(f'{p}:{b} {a} {d} {c}')
                elif p in('text-align','float') and v in('left','right') and '[dir=ltr]' not in sel:o.append(f'{p}:{swap(v)}')
            if o:
                sels=','.join('html[dir=ltr] '+x.strip() for x in sel.split(','))
                out.append(sels+'{'+';'.join(o)+'}')
    return out
print('\n'.join(rules(open(sys.argv[1]).read())))
