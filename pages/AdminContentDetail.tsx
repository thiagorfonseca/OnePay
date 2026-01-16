import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useComments, useContentItem, useLessonFiles, useLessons, useModules } from '../hooks/useContent';

const CONTENT_BUCKET = 'content-files';

const getPublicUrl = (path: string) => {
  const { data } = supabase.storage.from(CONTENT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const getStoragePath = (url: string) => {
  const marker = `/storage/v1/object/public/${CONTENT_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
};

const toSafeFileName = (name: string) => {
  const withoutAccents = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = withoutAccents.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const trimmed = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return trimmed || `file-${crypto.randomUUID()}`;
};

const uploadAsset = async (path: string, file: File) => {
  const { error } = await supabase.storage.from(CONTENT_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return getPublicUrl(path);
};

const LessonFilesManager: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const { data: files, refresh } = useLessonFiles(lessonId);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const safeName = toSafeFileName(file.name);
      const path = `lesson-files/${lessonId}/${crypto.randomUUID()}-${safeName}`;
      const publicUrl = await uploadAsset(path, file);
      const { error } = await supabase.from('content_lesson_files').insert({
        lesson_id: lessonId,
        file_name: file.name,
        file_url: publicUrl,
      });
      if (error) {
        alert(`Erro ao salvar arquivo: ${error.message}`);
        return;
      }
      refresh();
    } catch (error) {
      alert(`Erro ao enviar arquivo: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, fileUrl: string | null) => {
    if (!confirm('Excluir arquivo?')) return;
    try {
      if (fileUrl) {
        const path = getStoragePath(fileUrl);
        if (path) {
          const { error } = await supabase.storage.from(CONTENT_BUCKET).remove([path]);
          if (error) {
            alert(`Erro ao remover arquivo do storage: ${error.message}`);
            return;
          }
        }
      }
      const { error } = await supabase.from('content_lesson_files').delete().eq('id', fileId);
      if (error) {
        alert(`Erro ao excluir arquivo: ${error.message}`);
        return;
      }
      refresh();
    } catch (error) {
      alert(`Erro ao excluir arquivo: ${(error as Error).message}`);
    }
  };

  return (
    <div className="mt-2 border border-gray-100 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Materiais</p>
        <label className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded cursor-pointer">
          {uploading ? 'Enviando...' : 'Adicionar arquivo'}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhum arquivo anexado.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between text-sm">
              <a
                href={file.file_url || '#'}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                {file.file_name || 'Arquivo'}
              </a>
              <button
                type="button"
                onClick={() => handleDelete(file.id, file.file_url)}
                className="text-xs text-red-600 hover:underline"
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LessonFilesBadge: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const { data: files } = useLessonFiles(lessonId);
  const count = files.length;
  return (
    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
      {count} arquivo{count === 1 ? '' : 's'}
    </span>
  );
};

const ModuleCard: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { data: lessons, refresh } = useLessons(moduleId);
  const [openLessonFiles, setOpenLessonFiles] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, {
    title: string;
    description: string;
    panda_video_id: string;
    panda_video_url: string;
    order_index: number;
    published: boolean;
  }>>({});

  const [newLesson, setNewLesson] = useState({
    title: '',
    description: '',
    panda_video_id: '',
    panda_video_url: '',
    order_index: 1,
    published: false,
  });

  useEffect(() => {
    const map: Record<string, {
      title: string;
      description: string;
      panda_video_id: string;
      panda_video_url: string;
      order_index: number;
      published: boolean;
    }> = {};
    lessons.forEach((lesson) => {
      map[lesson.id] = {
        title: lesson.title || '',
        description: lesson.description || '',
        panda_video_id: lesson.panda_video_id || '',
        panda_video_url: lesson.panda_video_url || '',
        order_index: lesson.order_index ?? 0,
        published: !!lesson.published,
      };
    });
    setDrafts(map);
  }, [lessons]);

  const handleSaveLesson = async (lessonId: string) => {
    const draft = drafts[lessonId];
    if (!draft) return;
    if (draft.published && !draft.panda_video_id) {
      alert('Informe o Panda Video ID para publicar a aula.');
      return;
    }
    const { error } = await supabase
      .from('content_lessons')
      .update({
        title: draft.title.trim(),
        description: draft.description || null,
        panda_video_id: draft.panda_video_id || null,
        panda_video_url: draft.panda_video_url || null,
        order_index: draft.order_index,
        published: draft.published,
      })
      .eq('id', lessonId);
    if (error) {
      alert(`Erro ao salvar aula: ${error.message}`);
      return;
    }
    refresh();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Excluir aula?')) return;
    const { error } = await supabase.from('content_lessons').delete().eq('id', lessonId);
    if (error) {
      alert(`Erro ao excluir aula: ${error.message}`);
      return;
    }
    refresh();
  };

  const handleCreateLesson = async () => {
    if (!newLesson.title.trim()) return;
    if (newLesson.published && !newLesson.panda_video_id) {
      alert('Informe o Panda Video ID para publicar a aula.');
      return;
    }
    const { error } = await supabase.from('content_lessons').insert({
      module_id: moduleId,
      title: newLesson.title.trim(),
      description: newLesson.description || null,
      panda_video_id: newLesson.panda_video_id || null,
      panda_video_url: newLesson.panda_video_url || null,
      order_index: newLesson.order_index,
      published: newLesson.published,
    });
    if (error) {
      alert(`Erro ao criar aula: ${error.message}`);
      return;
    }
    setNewLesson({
      title: '',
      description: '',
      panda_video_id: '',
      panda_video_url: '',
      order_index: newLesson.order_index + 1,
      published: false,
    });
    refresh();
  };

  const swapLessonOrder = async (lessonId: string, direction: 'up' | 'down') => {
    const index = lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    const current = lessons[index];
    const target = lessons[targetIndex];
    const { error: firstError } = await supabase
      .from('content_lessons')
      .update({ order_index: target.order_index })
      .eq('id', current.id);
    if (firstError) {
      alert(`Erro ao reordenar aulas: ${firstError.message}`);
      return;
    }
    const { error: secondError } = await supabase
      .from('content_lessons')
      .update({ order_index: current.order_index })
      .eq('id', target.id);
    if (secondError) {
      alert(`Erro ao reordenar aulas: ${secondError.message}`);
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Ordem</th>
              <th className="px-3 py-2 text-left">Aula</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Panda ID</th>
              <th className="px-3 py-2 text-left">Arquivos</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lessons.map((lesson) => {
              const draft = drafts[lesson.id];
              return (
                <React.Fragment key={lesson.id}>
                  <tr className="align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={draft?.order_index ?? 0}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [lesson.id]: { ...prev[lesson.id], order_index: Number(e.target.value) },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded"
                        />
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => swapLessonOrder(lesson.id, 'up')}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => swapLessonOrder(lesson.id, 'down')}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={draft?.title || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lesson.id]: { ...prev[lesson.id], title: e.target.value },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <input
                          type="checkbox"
                          checked={!!draft?.published}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [lesson.id]: { ...prev[lesson.id], published: e.target.checked },
                            }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        Publicado
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={draft?.description || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lesson.id]: { ...prev[lesson.id], description: e.target.value },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        rows={2}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2 space-y-2">
                      <input
                        value={draft?.panda_video_id || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lesson.id]: { ...prev[lesson.id], panda_video_id: e.target.value },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        placeholder="ID do Panda"
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                      <input
                        value={draft?.panda_video_url || ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lesson.id]: { ...prev[lesson.id], panda_video_url: e.target.value },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        placeholder="URL/Embed"
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpenLessonFiles(openLessonFiles === lesson.id ? null : lesson.id)}
                        className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        <span>Arquivos</span>
                        <LessonFilesBadge lessonId={lesson.id} />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveLesson(lesson.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="text-xs px-2 py-1 bg-gray-900 text-white rounded"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openLessonFiles === lesson.id && (
                    <tr>
                      <td colSpan={6} className="px-3 pb-4">
                        <LessonFilesManager lessonId={lesson.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-gray-500">
                  Nenhuma aula cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-700">Nova aula</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={newLesson.title}
            onChange={(e) => setNewLesson((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Título"
            className="px-2 py-1 border border-gray-300 rounded"
          />
          <input
            value={newLesson.panda_video_id}
            onChange={(e) => setNewLesson((prev) => ({ ...prev, panda_video_id: e.target.value }))}
            placeholder="Panda Video ID"
            className="px-2 py-1 border border-gray-300 rounded"
          />
        </div>
        <textarea
          value={newLesson.description}
          onChange={(e) => setNewLesson((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descrição"
          rows={2}
          className="w-full px-2 py-1 border border-gray-300 rounded"
        />
        <input
          value={newLesson.panda_video_url}
          onChange={(e) => setNewLesson((prev) => ({ ...prev, panda_video_url: e.target.value }))}
          placeholder="URL/Embed (opcional)"
          className="w-full px-2 py-1 border border-gray-300 rounded"
        />
        <div className="flex flex-wrap gap-3 items-center text-sm text-gray-600">
          <label className="flex items-center gap-2">
            Ordem
            <input
              type="number"
              value={newLesson.order_index}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, order_index: Number(e.target.value) }))}
              className="w-20 px-2 py-1 border border-gray-300 rounded"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newLesson.published}
              onChange={(e) => setNewLesson((prev) => ({ ...prev, published: e.target.checked }))}
            />
            Publicado
          </label>
          <button
            type="button"
            onClick={handleCreateLesson}
            className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm"
          >
            Adicionar aula
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminContentDetail: React.FC = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get('tab') || 'about';
  const typeParam = searchParams.get('type');
  const { data: content, loading, refresh } = useContentItem(id);
  const { data: modules, refresh: refreshModules } = useModules(id);
  const [saving, setSaving] = useState(false);
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, { title: string; order_index: number; thumbnail_url: string }>>({});

  const [form, setForm] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    banner_url: '',
    published: false,
  });

  useEffect(() => {
    if (content) {
      setForm({
        title: content.title || '',
        description: content.description || '',
        thumbnail_url: content.thumbnail_url || '',
        banner_url: content.banner_url || '',
        published: !!content.published,
      });
    }
  }, [content]);

  useEffect(() => {
    const map: Record<string, { title: string; order_index: number; thumbnail_url: string }> = {};
    modules.forEach((module) => {
      map[module.id] = {
        title: module.title || '',
        order_index: module.order_index ?? 0,
        thumbnail_url: module.thumbnail_url || '',
      };
    });
    setModuleDrafts(map);
  }, [modules]);

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('content_items')
        .update({
          title: form.title.trim(),
          description: form.description || null,
          thumbnail_url: form.thumbnail_url || null,
          banner_url: form.banner_url || null,
          published: form.published,
        })
        .eq('id', content.id);
      if (error) {
        alert(`Erro ao salvar conteúdo: ${error.message}`);
        return;
      }
      refresh();
    } catch (error) {
      alert(`Erro ao salvar conteúdo: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (file: File, kind: 'thumbnail' | 'banner') => {
    if (!content?.id) return;
    try {
      const safeName = toSafeFileName(file.name);
      const path = `content-items/${content.id}/${kind}-${crypto.randomUUID()}-${safeName}`;
      const publicUrl = await uploadAsset(path, file);
      setForm((prev) => ({
        ...prev,
        thumbnail_url: kind === 'thumbnail' ? publicUrl : prev.thumbnail_url,
        banner_url: kind === 'banner' ? publicUrl : prev.banner_url,
      }));
    } catch (error) {
      alert(`Erro ao enviar imagem: ${(error as Error).message}`);
    }
  };

  const handleUploadModuleImage = async (moduleId: string, file: File) => {
    try {
      const safeName = toSafeFileName(file.name);
      const path = `content-modules/${moduleId}/thumbnail-${crypto.randomUUID()}-${safeName}`;
      const publicUrl = await uploadAsset(path, file);
      setModuleDrafts((prev) => ({
        ...prev,
        [moduleId]: {
          title: prev[moduleId]?.title || '',
          order_index: prev[moduleId]?.order_index ?? 0,
          thumbnail_url: publicUrl,
        },
      }));
    } catch (error) {
      alert(`Erro ao enviar imagem do módulo: ${(error as Error).message}`);
    }
  };

  const handleCreateModule = async () => {
    if (!content?.id) return;
    const { error } = await supabase.from('content_modules').insert({
      content_id: content.id,
      title: 'Novo módulo',
      order_index: modules.length + 1,
    });
    if (error) {
      alert(`Erro ao criar módulo: ${error.message}`);
      return;
    }
    refreshModules();
  };

  const handleUpdateModule = async (
    moduleId: string,
    title: string,
    orderIndex: number | null,
    thumbnailUrl: string | null
  ) => {
    const { error } = await supabase
      .from('content_modules')
      .update({ title: title.trim(), order_index: orderIndex, thumbnail_url: thumbnailUrl || null })
      .eq('id', moduleId);
    if (error) {
      alert(`Erro ao atualizar módulo: ${error.message}`);
      return;
    }
    refreshModules();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Excluir módulo?')) return;
    const { error } = await supabase.from('content_modules').delete().eq('id', moduleId);
    if (error) {
      alert(`Erro ao excluir módulo: ${error.message}`);
      return;
    }
    refreshModules();
  };

  const swapModuleOrder = async (moduleId: string, direction: 'up' | 'down') => {
    const index = modules.findIndex((module) => module.id === moduleId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const current = modules[index];
    const target = modules[targetIndex];
    const { error: firstError } = await supabase
      .from('content_modules')
      .update({ order_index: target.order_index })
      .eq('id', current.id);
    if (firstError) {
      alert(`Erro ao reordenar módulos: ${firstError.message}`);
      return;
    }
    const { error: secondError } = await supabase
      .from('content_modules')
      .update({ order_index: current.order_index })
      .eq('id', target.id);
    if (secondError) {
      alert(`Erro ao reordenar módulos: ${secondError.message}`);
      return;
    }
    refreshModules();
  };

  const { data: comments, refresh: refreshComments } = useComments({
    contentId: id || null,
    moduleId: searchParams.get('module') || null,
    lessonId: searchParams.get('lesson') || null,
    studentUserId: searchParams.get('student') || null,
  });

  const [studentOptions, setStudentOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [allLessons, setAllLessons] = useState<Array<{ id: string; module_id: string | null; title: string | null }>>([]);

  useEffect(() => {
    const loadLessons = async () => {
      if (!modules.length) {
        setAllLessons([]);
        return;
      }
      const moduleIds = modules.map((module) => module.id);
      const { data } = await supabase
        .from('content_lessons')
        .select('id, module_id, title')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true });
      setAllLessons((data || []) as Array<{ id: string; module_id: string | null; title: string | null }>);
    };
    loadLessons();
  }, [modules]);

  useEffect(() => {
    const loadStudents = async () => {
      const ids = Array.from(new Set(comments.map((comment) => comment.student_user_id).filter(Boolean))) as string[];
      if (!ids.length) {
        setStudentOptions([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const mapped = (data || []).map((item) => ({ id: item.id, name: item.full_name || item.id }));
      setStudentOptions(mapped);
    };
    loadStudents();
  }, [comments]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Carregando conteúdo...</div>;
  }

  if (!content) {
    return (
      <div className="space-y-3">
        <p className="text-gray-500">Conteúdo não encontrado.</p>
        <Link to="/admin/content" className="text-brand-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const backType = typeParam || content.type;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/admin/content?type=${backType}`} className="text-sm text-brand-600 hover:underline">
            ← Voltar para lista
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">{content.title || 'Sem título'}</h1>
          <p className="text-gray-500">{content.type === 'course' ? 'Curso' : 'Treinamento'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/admin/content?type=${backType}`)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Fechar
        </button>
      </div>

      <div className="flex gap-2">
        {['about', 'modules', 'comments'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams({ tab: key, type: backType })}
            className={`px-3 py-2 text-sm rounded-lg border ${
              tab === key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {key === 'about' ? 'Sobre' : key === 'modules' ? 'Módulos' : 'Comentários'}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Sobre</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Nome"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
                />
                Publicado
              </label>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Thumbnail URL</label>
                <input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <label className="text-xs px-2 py-1 bg-gray-100 rounded cursor-pointer inline-block">
                  {form.thumbnail_url ? 'Trocar thumbnail' : 'Upload thumbnail'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'thumbnail');
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Banner URL</label>
                <input
                  value={form.banner_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, banner_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <label className="text-xs px-2 py-1 bg-gray-100 rounded cursor-pointer inline-block">
                  {form.banner_url ? 'Trocar banner' : 'Upload banner'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'banner');
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                {form.banner_url ? (
                  <img src={form.banner_url} alt="Banner" className="w-full h-32 object-cover" />
                ) : (
                  <div className="h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    Banner 1250x250
                  </div>
                )}
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden w-40 h-40">
                {form.thumbnail_url ? (
                  <img src={form.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    Thumbnail
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'modules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Módulos</h2>
            <button
              type="button"
              onClick={handleCreateModule}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm"
            >
              Novo módulo
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-gray-500 text-sm">
              Nenhum módulo cadastrado.
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((module, index) => {
                const draft = moduleDrafts[module.id];
                return (
                <details key={module.id} open className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft?.title || ''}
                        onChange={(e) =>
                          setModuleDrafts((prev) => ({
                            ...prev,
                            [module.id]: {
                              title: e.target.value,
                              order_index: prev[module.id]?.order_index ?? 0,
                              thumbnail_url: prev[module.id]?.thumbnail_url || '',
                            },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        value={draft?.order_index ?? 0}
                        onChange={(e) =>
                          setModuleDrafts((prev) => ({
                            ...prev,
                            [module.id]: {
                              title: prev[module.id]?.title || '',
                              order_index: Number(e.target.value),
                              thumbnail_url: prev[module.id]?.thumbnail_url || '',
                            },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                      />
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            swapModuleOrder(module.id, 'up');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            swapModuleOrder(module.id, 'down');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUpdateModule(
                            module.id,
                            draft?.title || '',
                            draft?.order_index ?? 0,
                            draft?.thumbnail_url || ''
                          );
                        }}
                        className="text-xs px-2 py-1 bg-gray-900 text-white rounded"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteModule(module.id);
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                    <span className="text-xs text-gray-500">Módulo {index + 1}</span>
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-500">Imagem do módulo (URL)</label>
                      <input
                        value={draft?.thumbnail_url || ''}
                        onChange={(e) =>
                          setModuleDrafts((prev) => ({
                            ...prev,
                            [module.id]: {
                              title: prev[module.id]?.title || '',
                              order_index: prev[module.id]?.order_index ?? 0,
                              thumbnail_url: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <label className="text-xs px-2 py-2 bg-gray-100 rounded cursor-pointer text-gray-600 text-center">
                      Upload imagem
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadModuleImage(module.id, file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <ModuleCard moduleId={module.id} />
                </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Comentários</h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={searchParams.get('module') || ''}
              onChange={(e) => setSearchParams({ tab: 'comments', type: backType, module: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os módulos</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title || 'Sem módulo'}
                </option>
              ))}
            </select>
            <select
              value={searchParams.get('lesson') || ''}
              onChange={(e) =>
                setSearchParams({
                  tab: 'comments',
                  type: backType,
                  module: searchParams.get('module') || '',
                  lesson: e.target.value,
                  student: searchParams.get('student') || '',
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Todas as aulas</option>
              {allLessons
                .filter((lesson) => {
                  const moduleFilter = searchParams.get('module');
                  if (!moduleFilter) return true;
                  return lesson.module_id === moduleFilter;
                })
                .map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title || lesson.id}
                  </option>
                ))}
            </select>
            <select
              value={searchParams.get('student') || ''}
              onChange={(e) =>
                setSearchParams({
                  tab: 'comments',
                  type: backType,
                  module: searchParams.get('module') || '',
                  lesson: searchParams.get('lesson') || '',
                  student: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os alunos</option>
              {studentOptions.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-100">
            {comments.length === 0 && (
              <div className="p-4 text-sm text-gray-500">Nenhum comentário encontrado.</div>
            )}
            {comments.map((comment) => (
              <details key={comment.id} className="p-4">
                <summary className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Comentário</p>
                    <p className="text-xs text-gray-500">{comment.created_at?.slice(0, 10)}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      comment.status === 'answered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {comment.status === 'answered' ? 'Respondido' : 'Pendente'}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <p>{comment.content || 'Sem conteúdo.'}</p>
                  {comment.status !== 'answered' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.from('content_comments').update({ status: 'answered' }).eq('id', comment.id);
                        refreshComments();
                      }}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Marcar como respondido
                    </button>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContentDetail;
