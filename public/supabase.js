// LorranStack v2.1 — Cliente Supabase direto no frontend
const _SB_URL = 'https://jkgrmlfqgprcwfooovkx.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ3JtbGZxZ3ByY3dmb29vdmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTY4NTIsImV4cCI6MjA4ODgzMjg1Mn0.f0N9ase2ZoYKq4JL7zVT9rzrjjsslYMPLcwd-k5Z8DA';

async function _sb(path) {
  const res = await fetch(_SB_URL + '/rest/v1/' + path, {
    headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY }
  });
  if (!res.ok) throw new Error('SB ' + res.status);
  return res.json();
}

window.DB = {
  async getCategories() {
    return _sb('ls_categories?select=id,name,slug,icon&order=sort_order.asc');
  },
  async getFeatured() {
    const rows = await _sb('ls_saas?select=id,name,slug,tagline,logo_url,pricing_type,price_label,upvotes,avg_rating,review_count,is_featured,category_id,creator_id&is_featured=eq.true&status=in.(approved,featured)&order=upvotes.desc&limit=6');
    return window.DB._joinMeta(rows);
  },
  async getSaas({ sort='upvotes', order='desc', page=1, limit=12, category, search } = {}) {
    let q = 'ls_saas?select=id,name,slug,tagline,logo_url,pricing_type,price_label,upvotes,views,avg_rating,review_count,is_featured,category_id,creator_id&status=in.(approved,featured)';
    if (search) q += '&or=(name.ilike.*' + encodeURIComponent(search) + '*,tagline.ilike.*' + encodeURIComponent(search) + '*)';
    q += '&order=' + sort + '.' + order + '&limit=' + limit + '&offset=' + ((page-1)*limit);
    const rows = await _sb(q);
    const joined = await window.DB._joinMeta(rows);
    if (category) {
      const cats = await window.DB.getCategories();
      const cat = cats.find(function(c){ return c.slug === category; });
      if (cat) return joined.filter(function(r){ return r.category_id === cat.id; });
    }
    return joined;
  },
  async getSaasBySlug(slug) {
    const rows = await _sb('ls_saas?select=*&slug=eq.' + slug + '&status=in.(approved,featured)&limit=1');
    if (!rows.length) return null;
    const s = rows[0];
    const cats  = await _sb('ls_categories?select=name,slug,icon&id=eq.' + s.category_id);
    const users = await _sb('ls_users?select=name,bio,website&id=eq.' + s.creator_id);
    const revs  = await _sb('ls_reviews?select=id,rating,comment,created_at,user_id&saas_id=eq.' + s.id + '&order=created_at.desc&limit=20');
    s.category_name = cats[0] ? cats[0].name : '';
    s.category_icon = cats[0] ? cats[0].icon : '';
    s.creator_name  = users[0] ? users[0].name : 'Anônimo';
    s.creator_bio   = users[0] ? users[0].bio  : '';
    s.creator_website = users[0] ? users[0].website : '';
    if (revs.length) {
      const uids = revs.map(function(r){ return r.user_id; }).filter(Boolean);
      const ulist = uids.length ? await _sb('ls_users?select=id,name&id=in.(' + uids.join(',') + ')') : [];
      const umap = {};
      ulist.forEach(function(u){ umap[u.id] = u.name; });
      revs.forEach(function(r){ r.user_name = umap[r.user_id] || 'Usuário'; });
    }
    s.reviews = revs;
    return s;
  },
  async getStats() {
    const [r1,r2] = await Promise.all([
      fetch(_SB_URL+'/rest/v1/ls_saas?select=id&status=in.(approved,featured)',{headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Prefer':'count=exact','Range':'0-0'}}),
      fetch(_SB_URL+'/rest/v1/ls_users?select=id',{headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Prefer':'count=exact','Range':'0-0'}})
    ]);
    return {
      saas:  parseInt((r1.headers.get('content-range')||'0/15').split('/')[1]),
      users: parseInt((r2.headers.get('content-range')||'0/8').split('/')[1])
    };
  },
  async _joinMeta(rows) {
    if (!rows.length) return rows;
    const cids = [...new Set(rows.map(function(r){return r.category_id;}).filter(Boolean))];
    const uids = [...new Set(rows.map(function(r){return r.creator_id;}).filter(Boolean))];
    const cats  = cids.length ? await _sb('ls_categories?select=id,name,slug,icon&id=in.(' + cids.join(',') + ')') : [];
    const users = uids.length ? await _sb('ls_users?select=id,name&id=in.(' + uids.join(',') + ')') : [];
    const cmap={}, umap={};
    cats.forEach(function(c){cmap[c.id]=c;}); users.forEach(function(u){umap[u.id]=u;});
    return rows.map(function(r){
      return Object.assign({},r,{
        category_name: cmap[r.category_id] ? cmap[r.category_id].name : '',
        category_icon: cmap[r.category_id] ? cmap[r.category_id].icon : '',
        category_slug: cmap[r.category_id] ? cmap[r.category_id].slug : '',
        creator_name:  umap[r.creator_id]  ? umap[r.creator_id].name  : 'Anônimo',
      });
    });
  }
};
window.API = null;
