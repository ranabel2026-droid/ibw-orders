(function(){
var EN=__EN__;
var AR=/[\u0600-\u06FF]/;
var saved=null;try{saved=localStorage.getItem('ibw-lang');}catch(e){}
var nav=((navigator.languages&&navigator.languages[0])||navigator.language||'ar').toLowerCase();
var LANG=(saved==='ar'||saved==='en')?saved:(nav.indexOf('ar')===0?'ar':'en');
window.IBW_LANG=LANG;
var root=document.documentElement;root.lang=LANG;root.dir=LANG==='en'?'ltr':'rtl';
// Multi-word phrases may be replaced inside longer text; single words only on exact match,
// so customer-entered names/addresses are never altered.
var phrases=Object.keys(EN).filter(function(k){return /\s/.test(k.trim())||k.length>12;}).sort(function(a,b){return b.length-a.length;});
function tr(s){
  if(LANG!=='en'||!s||!AR.test(s))return s;
  var t=s.trim();
  if(EN[t])return s.replace(t,EN[t]);
  var out=s;
  for(var i=0;i<phrases.length&&AR.test(out);i++){var k=phrases[i];if(out.indexOf(k)>-1)out=out.split(k).join(EN[k]);}
  if(out!==s)out=out.replace(/[\u0600-\u06FF]+/g,function(w){return EN[w]||w;});
  return out;
}
window.ibwT=tr;
var ATTRS=['placeholder','aria-label','title','alt'];
function walk(n){
  if(n.nodeType===3){var v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;return;}
  if(n.nodeType!==1||n.tagName==='SCRIPT'||n.tagName==='STYLE')return;
  for(var a=0;a<ATTRS.length;a++){var at=n.getAttribute(ATTRS[a]);if(at&&AR.test(at)){var nv=tr(at);if(nv!==at)n.setAttribute(ATTRS[a],nv);}}
  if(n.tagName!=='TEXTAREA')for(var c=n.firstChild;c;c=c.nextSibling)walk(c);
}
if(LANG==='en'){
  new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='characterData')walk(m.target);else if(m.type==='attributes')walk(m.target);else m.addedNodes.forEach(walk);});})
   .observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  document.addEventListener('DOMContentLoaded',function(){walk(document.documentElement);});
  var oc=window.confirm.bind(window),oa=window.alert.bind(window);
  window.confirm=function(m){return oc(tr(String(m)));};window.alert=function(m){return oa(tr(String(m)));};
}
window.langBtn=function(extra){return '<button type="button" class="lang-toggle '+(extra||'')+'" data-lang-toggle aria-label="'+(LANG==='en'?'التبديل إلى العربية':'Switch to English')+'"><span class="'+(LANG==='ar'?'on':'')+'">ع</span><span class="'+(LANG==='en'?'on':'')+'">EN</span></button>';};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-lang-toggle]');if(!b)return;e.preventDefault();try{localStorage.setItem('ibw-lang',LANG==='en'?'ar':'en');}catch(x){}location.reload();});
})();
