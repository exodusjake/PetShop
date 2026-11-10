import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError, api, useApi } from '../../lib/api';
import type { Paged } from '../../lib/adminTypes';
import { formatDate } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, ImageUploader, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

interface Post { id: number; title: string; slug: string; excerpt: string; content: string; coverUrl: string | null; categoryId: number; category: string; status: 'DRAFT' | 'PUBLISHED'; readMinutes: number; isDemo: boolean; publishedAt: string | null; updatedAt: string }

const schema = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(200), excerpt: z.string().trim().min(10, 'Write a short summary (10+ characters)').max(400),
  content: z.string().trim().min(30, 'Write the article (30+ characters)').max(20000), categoryId: z.number({ invalid_type_error: 'Choose a category' }).int().positive('Choose a category'),
  status: z.enum(['DRAFT', 'PUBLISHED']),
});
type Form = z.infer<typeof schema>;

function PostForm({ post, onSaved, onClose }: { post: Post | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const cats = useApi<{ id: number; name: string }[]>('/admin/blog/categories').data ?? [];
  const [cover, setCover] = useState<string[]>(post?.coverUrl ? [post.coverUrl] : []);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, watch, setError, setValue, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: post ? { title: post.title, excerpt: post.excerpt, content: post.content, categoryId: post.categoryId, status: post.status } : { title: '', excerpt: '', content: '', categoryId: undefined as unknown as number, status: 'DRAFT' },
  });
  useEffect(() => { if (!post && cats[0]) setValue('categoryId', cats[0].id); }, [cats.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = (watch('content') ?? '').split(/\s+/).filter(Boolean).length;
  const e = (k: keyof Form) => errors[k]?.message as string | undefined;

  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { await api(post ? `/admin/blog/posts/${post.id}` : '/admin/blog/posts', { method: post ? 'PATCH' : 'POST', json: { ...v, coverUrl: cover[0] ?? null } }); toast(v.status === 'PUBLISHED' ? 'Article published' : 'Draft saved'); onSaved(); }
    catch (ex) { if (ex instanceof ApiError) { for (const [k, m] of Object.entries(ex.issues)) if (m[0]) setError(k as keyof Form, { message: m[0] }); setErr(ex.message); } else setErr('Something went wrong.'); }
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <Field label="Title" htmlFor="b-title" error={e('title')}><TextInput id="b-title" invalid={!!errors.title} {...register('title')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="b-cat" error={e('categoryId')}><select id="b-cat" className="input" {...register('categoryId', { valueAsNumber: true })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Status" htmlFor="b-status" hint="Drafts are only visible to admins."><select id="b-status" className="input" {...register('status')}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></Field>
      </div>
      <Field label="Summary" htmlFor="b-excerpt" error={e('excerpt')} hint="Shown on blog cards and search results."><textarea id="b-excerpt" rows={2} className="input" {...register('excerpt')} /></Field>
      <ImageUploader value={cover} onChange={setCover} max={1} label="Cover image" />
      <Field label="Article" htmlFor="b-content" error={e('content')} hint={`Plain text. Leave a blank line between paragraphs and start a line with "## " for a heading. ${words} words · about ${Math.max(1, Math.ceil(words / 200))} min read`}>
        <textarea id="b-content" rows={12} className={`input font-mono !text-[13px] ${errors.content ? '!border-red-500' : ''}`} {...register('content')} />
      </Field>
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save article'}</button></div>
    </form>
  );
}

export default function BlogAdmin() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Post | 'new' | null>(null), [del, setDel] = useState<Post | null>(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, loading } = useApi<Paged<Post>>(withKey(`/admin/blog/posts?page=${page}${status ? `&status=${status}` : ''}${term ? `&q=${encodeURIComponent(term)}` : ''}`));

  return (
    <div>
      <PageHeader title="Blog" subtitle="Write, publish and manage pet care articles." actions={<button className="btn btn-sm" onClick={() => setEdit('new')}><Plus size={16} /> New article</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search articles" /></div>
        <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All</option><option value="PUBLISHED">Published</option><option value="DRAFT">Drafts</option></select>
      </div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(p) => p.id} empty="No articles yet."
        columns={[
          { header: 'Article', cell: (p) => <div className="flex items-center gap-3">{p.coverUrl ? <img src={p.coverUrl} alt="" className="h-11 w-16 rounded-lg bg-[#FDEEE3] object-cover" /> : <div className="h-11 w-16 rounded-lg bg-[#FDEEE3]" />}<div><p className="font-extrabold">{p.title}{p.isDemo && <span className="ml-2 text-xs font-bold text-choco-soft">(demo)</span>}</p><p className="text-xs text-choco-soft">{p.category} · {p.readMinutes} min read</p></div></div> },
          { header: 'Status', cell: (p) => <Pill value={p.status} /> }, { header: 'Published', cell: (p) => (p.publishedAt ? formatDate(p.publishedAt) : '—') }, { header: 'Updated', cell: (p) => formatDate(p.updatedAt) },
          { header: 'Actions', className: 'text-right', cell: (p) => (
            <div className="flex justify-end gap-1">
              {p.status === 'PUBLISHED' && <Link to={`/blog/${p.slug}`} target="_blank" className="rounded-full p-2 hover:bg-peach" aria-label={`View ${p.title}`}><ExternalLink size={16} /></Link>}
              <button className="rounded-full p-2 hover:bg-peach" aria-label={`Edit ${p.title}`} onClick={() => setEdit(p)}><Pencil size={16} /></button>
              <button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${p.title}`} onClick={() => setDel(p)}><Trash2 size={16} /></button>
            </div>) },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      <Modal open={edit !== null} title={edit === 'new' ? 'New article' : 'Edit article'} onClose={() => setEdit(null)} wide>
        {edit !== null && <PostForm key={edit === 'new' ? 'new' : edit.id} post={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title="Delete this article?" confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const p = del!; setDel(null); try { await api(`/admin/blog/posts/${p.id}`, { method: 'DELETE' }); toast('Article deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        <b>{del?.title}</b> will be permanently deleted. To just hide it, switch it back to Draft instead.
      </ConfirmationModal>
    </div>
  );
}
