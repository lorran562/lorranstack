// LorranStack v3.1 — Supabase REST (CORS OK) + Auth SHA-256
const _SB  = 'https://jkgrmlfqgprcwfooovkx.supabase.co/rest/v1';
const _KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ3JtbGZxZ3ByY3dmb29vdmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTY4NTIsImV4cCI6MjA4ODgzMjg1Mn0.f0N9ase2ZoYKq4JL7zVT9rzrjjsslYMPLcwd-k5Z8DA';
const _H    = {'apikey':_KEY,'Authorization':'Bearer '+_KEY,'Content-Type':'application/json','Prefer':'return=representation'};

async function _q(path,opts){
  const r=await fetch(_SB+'/'+path,Object.assign({headers:_H},opts||{}));
  if(!r.ok){const t=await r.text();throw new Error('DB '+r.status+': '+t.slice(0,100));}
  const t=await r.text(); return t?JSON.parse(t):[];
}

async function _hashPwd(p){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p+'_lorranstack_salt'));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

window.AUTH={
  async register(name,email,password,role){
    const ex=await _q('ls_users?select=id&email=eq.'+encodeURIComponent(email));
    if(ex.length) throw new Error('Email já cadastrado');
    const hash=await _hashPwd(password);
    const rows=await _q('ls_users',{method:'POST',body:JSON.stringify({name,email,password:hash,role:role||'user'})});
    const u=Array.isArray(rows)?rows[0]:rows;
    const token=btoa(JSON.stringify({id:u.id,email:u.email,role:u.role,exp:Date.now()+604800000}));
    return {token,user:{id:u.id,name:u.name||name,email:u.email,role:u.role}};
  },
  async login(email,password){
    const rows=await _q('ls_users?select=id,name,email,role,password&email=eq.'+encodeURIComponent(email));
    if(!rows.length) throw new Error('Email ou senha incorretos');
    const u=rows[0];
    const hash=await _hashPwd(password);
    if(u.password!==hash) throw new Error('Email ou senha incorretos');
    const token=btoa(JSON.stringify({id:u.id,email:u.email,role:u.role,exp:Date.now()+604800000}));
    return {token,user:{id:u.id,name:u.name,email:u.email,role:u.role}};
  },
  getUser(){try{return JSON.parse(localStorage.getItem('ls_user')||'null');}catch{return null;}},
  getToken(){return localStorage.getItem('ls_token');},
  isLoggedIn(){return !!this.getUser();},
  logout(){localStorage.removeItem('ls_token');localStorage.removeItem('ls_user');}
};

window.DB={
  async getCategories(){
    return _q('ls_categories?select=id,name,slug,icon&order=sort_order.asc');
  },
  async getFeatured(){
    const rows=await _q('ls_saas?select=id,name,slug,tagline,logo_url,pricing_type,price_label,upvotes,avg_rating,review_count,is_featured,category_id,creator_id&is_featured=eq.true&status=in.(approved,featured)&order=upvotes.desc&limit=6');
    return this._join(rows);
  },
  async getSaas({sort='upvotes',order='desc',page=1,limit=12,category,search}={}){
    let q='ls_saas?select=id,name,slug,tagline,logo_url,pricing_type,price_label,upvotes,views,avg_rating,review_count,is_featured,category_id,creator_id&status=in.(approved,featured)';
    if(search) q+='&or=(name.ilike.*'+encodeURIComponent(search)+'*,tagline.ilike.*'+encodeURIComponent(search)+'*)';
    const col=['upvotes','views','avg_rating','created_at'].includes(sort)?sort:'upvotes';
    q+='&order='+col+'.'+(order==='asc'?'asc':'desc')+'&limit='+limit+'&offset='+((page-1)*limit);
    const rows=await _q(q);
    const joined=await this._join(rows);
    if(category){
      const cats=await this.getCategories();
      const cat=cats.find(c=>c.slug===category);
      if(cat) return joined.filter(r=>r.category_id===cat.id);
    }
    return joined;
  },
  async getSaasBySlug(slug){
    const rows=await _q('ls_saas?select=*&slug=eq.'+slug+'&status=in.(approved,featured)&limit=1');
    if(!rows.length) return null;
    const s=rows[0];
    const [cats,users,revs]=await Promise.all([
      _q('ls_categories?select=name,slug,icon&id=eq.'+s.category_id),
      _q('ls_users?select=name,bio,website&id=eq.'+s.creator_id),
      _q('ls_reviews?select=id,rating,comment,created_at,user_id&saas_id=eq.'+s.id+'&order=created_at.desc&limit=20')
    ]);
    s.category_name=cats[0]?.name||'';s.category_icon=cats[0]?.icon||'';
    s.creator_name=users[0]?.name||'Anônimo';s.creator_bio=users[0]?.bio||'';s.creator_website=users[0]?.website||'';
    if(revs.length){
      const uids=[...new Set(revs.map(r=>r.user_id).filter(Boolean))];
      const ul=uids.length?await _q('ls_users?select=id,name&id=in.('+uids.join(',')+')'):[]; 
      const um={};ul.forEach(u=>{um[u.id]=u.name;});
      revs.forEach(r=>{r.user_name=um[r.user_id]||'Usuário';});
    }
    s.reviews=revs; return s;
  },
  async getStats(){
    const [r1,r2]=await Promise.all([
      fetch(_SB+'/ls_saas?select=id&status=in.(approved,featured)',{headers:{..._H,'Prefer':'count=exact','Range':'0-0'}}),
      fetch(_SB+'/ls_users?select=id',{headers:{..._H,'Prefer':'count=exact','Range':'0-0'}})
    ]);
    return{
      saas:parseInt((r1.headers.get('content-range')||'0/15').split('/')[1]),
      users:parseInt((r2.headers.get('content-range')||'0/9').split('/')[1])
    };
  },
  async addReview(saasId,rating,comment,userId){
    return _q('ls_reviews',{method:'POST',body:JSON.stringify({saas_id:saasId,rating,comment,user_id:userId})});
  },
  async getCollections(){
    return _q('ls_collections?select=id,title,slug,description,cover_emoji,saas_ids,is_official&is_official=eq.true&order=view_count.desc');
  },
  async getCreatorSaas(userId){
    const rows=await _q('ls_saas?select=id,name,slug,status,views,clicks,upvotes,avg_rating,review_count,created_at,category_id&creator_id=eq.'+userId+'&order=created_at.desc');
    return this._join(rows);
  },
  async submitSaas(data){
    const slug=data.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now();
    return _q('ls_saas',{method:'POST',body:JSON.stringify({...data,slug,status:'pending'})});
  },
  async _join(rows){
    if(!rows.length) return rows;
    const cids=[...new Set(rows.map(r=>r.category_id).filter(Boolean))];
    const uids=[...new Set(rows.map(r=>r.creator_id).filter(Boolean))];
    const [cats,users]=await Promise.all([
      cids.length?_q('ls_categories?select=id,name,slug,icon&id=in.('+cids.join(',')+')'):Promise.resolve([]),
      uids.length?_q('ls_users?select=id,name&id=in.('+uids.join(',')+')'):Promise.resolve([])
    ]);
    const cm={},um={};cats.forEach(c=>{cm[c.id]=c;});users.forEach(u=>{um[u.id]=u;});
    return rows.map(r=>({...r,
      category_name:cm[r.category_id]?.name||'',
      category_icon:cm[r.category_id]?.icon||'',
      category_slug:cm[r.category_id]?.slug||'',
      creator_name:um[r.creator_id]?.name||'Anônimo'
    }));
  }
};
window.API=null;
