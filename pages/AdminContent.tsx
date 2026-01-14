import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ContentItem {
  id: string;
  type: 'course' | 'training';
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  published: boolean | null;
  created_at: string | null;
}

interface ContentModule {
  id: string;
  content_id: string | null;
  title: string | null;
  order_index: number | null;
}

interface ContentLesson {
  id: string;
  module_id: string | null;
  title: string | null;
  description: string | null;
  panda_video_id: string | null;
  panda_video_url: string | null;
  order_index: number | null;
  published: boolean | null;
}

interface ModuleWithLessons extends ContentModule {
  lessons: ContentLesson[];
}

interface Props {
  type: 'course' | 'training';
}

const AdminContent: React.FC<Props> = ({ type }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [savingItem, setSavingItem] = useState(false);

  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    published: false,
  });

  const [editItem, setEditItem] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    published: false,
  });

  const [newModule, setNewModule] = useState({ title: '', order_index: 1 });
  const [newLessonByModule, setNewLessonByModule] = useState<Record<string, {
    title: string;
    description: string;
    panda_video_url: string;
    order_index: number;
    published: boolean;
  }>>({});

  const typeLabel = type === 'course' ? 'Cursos' : 'Treinamentos';

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const loadItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });
    setItems((data || []) as ContentItem[]);
    setLoading(false);
  };

  const loadModules = async (contentId: string) => {
    const { data: modulesData } = await supabase
      .from('content_modules')
      .select('*')
      .eq('content_id', contentId)
      .order('order_index', { ascending: true });
    const modulesList = (modulesData || []) as ContentModule[];
    if (!modulesList.length) {
      setModules([]);
      return;
    }
    const moduleIds = modulesList.map((module) => module.id);
    const { data: lessonsData } = await supabase
      .from('content_lessons')
      .select('*')
      .in('module_id', moduleIds)
      .order('order_index', { ascending: true });
    const lessonsList = (lessonsData || []) as ContentLesson[];
    const byModule: Record<string, ContentLesson[]> = {};
    lessonsList.forEach((lesson) => {
      if (!lesson.module_id) return;
      if (!byModule[lesson.module_id]) byModule[lesson.module_id] = [];
      byModule[lesson.module_id].push(lesson);
    });
    const merged = modulesList.map((module) => ({
      ...module,
      lessons: byModule[module.id] || [],
    }));
    setModules(merged);
  };

  useEffect(() => {
    loadItems();
  }, [type]);

  useEffect(() => {
    if (!selectedId && items.length) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (selectedItem) {
      setEditItem({
        title: selectedItem.title || '',
        description: selectedItem.description || '',
        thumbnail_url: selectedItem.thumbnail_url || '',
        published: !!selectedItem.published,
      });
      loadModules(selectedItem.id);
    } else {
      setModules([]);
    }
  }, [selectedItem]);

  const handleCreateItem = async () => {
    if (!newItem.title.trim()) return;
    setSavingItem(true);
    const { error } = await supabase.from('content_items').insert({
      type,
      title: newItem.title.trim(),
      description: newItem.description || null,
      thumbnail_url: newItem.thumbnail_url || null,
      published: newItem.published,
    });
    setSavingItem(false);
    if (!error) {
      setNewItem({ title: '', description: '', thumbnail_url: '', published: false });
      loadItems();
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    setSavingItem(true);
    const { error } = await supabase
      .from('content_items')
      .update({
        title: editItem.title.trim(),
        description: editItem.description || null,
        thumbnail_url: editItem.thumbnail_url || null,
        published: editItem.published,
      })
      .eq('id', selectedItem.id);
    setSavingItem(false);
    if (!error) loadItems();
  };

  const handleCreateModule = async () => {
    if (!selectedItem || !newModule.title.trim()) return;
    const { error } = await supabase.from('content_modules').insert({
      content_id: selectedItem.id,
      title: newModule.title.trim(),
      order_index: newModule.order_index,
    });
    if (!error) {
      setNewModule({ title: '', order_index: newModule.order_index + 1 });
      loadModules(selectedItem.id);
    }
  };

  const handleUpdateModule = async (module: ContentModule) => {
    await supabase
      .from('content_modules')
      .update({
        title: module.title,
        order_index: module.order_index,
      })
      .eq('id', module.id);
  };

  const handleCreateLesson = async (moduleId: string) => {
    const draft = newLessonByModule[moduleId];
    if (!draft || !draft.title.trim()) return;
    const { error } = await supabase.from('content_lessons').insert({
      module_id: moduleId,
      title: draft.title.trim(),
      description: draft.description || null,
      panda_video_url: draft.panda_video_url || null,
      order_index: draft.order_index,
      published: draft.published,
    });
    if (!error && selectedItem) {
      setNewLessonByModule((prev) => ({
        ...prev,
        [moduleId]: { title: '', description: '', panda_video_url: '', order_index: draft.order_index + 1, published: false },
      }));
      loadModules(selectedItem.id);
    }
  };

  const handleUpdateLesson = async (lesson: ContentLesson) => {
    await supabase
      .from('content_lessons')
      .update({
        title: lesson.title,
        description: lesson.description,
        panda_video_url: lesson.panda_video_url,
        order_index: lesson.order_index,
        published: lesson.published,
      })
      .eq('id', lesson.id);
  };

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Carregando {typeLabel}...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{typeLabel} (Admin)</h1>
        <p className="text-gray-500">Gerencie cursos, módulos e aulas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <aside className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Conteúdos</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selectedId === item.id ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.title || 'Sem título'}
              </button>
            ))}
            {items.length === 0 && <p className="text-sm text-gray-500">Nenhum conteúdo cadastrado.</p>}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Novo {typeLabel.slice(0, -1)}</h3>
            <input
              value={newItem.title}
              onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Título"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={newItem.thumbnail_url}
              onChange={(e) => setNewItem((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
              placeholder="Thumbnail URL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newItem.published}
                onChange={(e) => setNewItem((prev) => ({ ...prev, published: e.target.checked }))}
              />
              Publicado
            </label>
            <button
              type="button"
              onClick={handleCreateItem}
              disabled={savingItem}
              className="w-full px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              Criar
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          {!selectedItem ? (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-gray-500 text-sm">
              Selecione um conteúdo para editar.
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Detalhes do conteúdo</h2>
                  <button
                    type="button"
                    onClick={handleUpdateItem}
                    disabled={savingItem}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
                <input
                  value={editItem.title}
                  onChange={(e) => setEditItem((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Título"
                />
                <textarea
                  value={editItem.description}
                  onChange={(e) => setEditItem((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Descrição"
                />
                <input
                  value={editItem.thumbnail_url}
                  onChange={(e) => setEditItem((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Thumbnail URL"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={editItem.published}
                    onChange={(e) => setEditItem((prev) => ({ ...prev, published: e.target.checked }))}
                  />
                  Publicado
                </label>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Módulos e aulas</h2>
                </div>

                {modules.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhum módulo criado ainda.</p>
                )}

                {modules.map((module) => (
                  <div key={module.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
                      <div>
                        <label className="text-xs text-gray-500">Módulo</label>
                        <input
                          value={module.title || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setModules((prev) =>
                              prev.map((m) => (m.id === module.id ? { ...m, title: value } : m))
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Ordem</label>
                        <input
                          type="number"
                          value={module.order_index ?? 0}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setModules((prev) =>
                              prev.map((m) => (m.id === module.id ? { ...m, order_index: value } : m))
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateModule(module)}
                        className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm"
                      >
                        Salvar módulo
                      </button>
                    </div>

                    <div className="space-y-3">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              value={lesson.title || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setModules((prev) =>
                                  prev.map((m) =>
                                    m.id === module.id
                                      ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, title: value } : l)) }
                                      : m
                                  )
                                );
                              }}
                              placeholder="Título da aula"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <input
                              value={lesson.panda_video_url || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setModules((prev) =>
                                  prev.map((m) =>
                                    m.id === module.id
                                      ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, panda_video_url: value } : l)) }
                                      : m
                                  )
                                );
                              }}
                              placeholder="Link Panda Video"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <textarea
                            value={lesson.description || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setModules((prev) =>
                                prev.map((m) =>
                                  m.id === module.id
                                    ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, description: value } : l)) }
                                    : m
                                )
                              );
                            }}
                            placeholder="Descrição"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <div className="flex flex-wrap gap-3 items-center text-sm text-gray-600">
                            <label className="flex items-center gap-2">
                              Ordem
                              <input
                                type="number"
                                value={lesson.order_index ?? 0}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  setModules((prev) =>
                                    prev.map((m) =>
                                      m.id === module.id
                                        ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, order_index: value } : l)) }
                                        : m
                                    )
                                  );
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!lesson.published}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setModules((prev) =>
                                    prev.map((m) =>
                                      m.id === module.id
                                        ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, published: checked } : l)) }
                                        : m
                                    )
                                  );
                                }}
                              />
                              Publicado
                            </label>
                            <button
                              type="button"
                              onClick={() => handleUpdateLesson(lesson)}
                              className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm"
                            >
                              Salvar aula
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-gray-700">Adicionar aula</p>
                        <input
                          value={newLessonByModule[module.id]?.title || ''}
                          onChange={(e) =>
                            setNewLessonByModule((prev) => ({
                              ...prev,
                              [module.id]: {
                                title: e.target.value,
                                description: prev[module.id]?.description || '',
                                panda_video_url: prev[module.id]?.panda_video_url || '',
                                order_index: prev[module.id]?.order_index || 1,
                                published: prev[module.id]?.published || false,
                              },
                            }))
                          }
                          placeholder="Título da aula"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <textarea
                          value={newLessonByModule[module.id]?.description || ''}
                          onChange={(e) =>
                            setNewLessonByModule((prev) => ({
                              ...prev,
                              [module.id]: {
                                title: prev[module.id]?.title || '',
                                description: e.target.value,
                                panda_video_url: prev[module.id]?.panda_video_url || '',
                                order_index: prev[module.id]?.order_index || 1,
                                published: prev[module.id]?.published || false,
                              },
                            }))
                          }
                          placeholder="Descrição"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          value={newLessonByModule[module.id]?.panda_video_url || ''}
                          onChange={(e) =>
                            setNewLessonByModule((prev) => ({
                              ...prev,
                              [module.id]: {
                                title: prev[module.id]?.title || '',
                                description: prev[module.id]?.description || '',
                                panda_video_url: e.target.value,
                                order_index: prev[module.id]?.order_index || 1,
                                published: prev[module.id]?.published || false,
                              },
                            }))
                          }
                          placeholder="Link Panda Video"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex flex-wrap gap-3 items-center text-sm text-gray-600">
                          <label className="flex items-center gap-2">
                            Ordem
                            <input
                              type="number"
                              value={newLessonByModule[module.id]?.order_index || 1}
                              onChange={(e) =>
                                setNewLessonByModule((prev) => ({
                                  ...prev,
                                  [module.id]: {
                                    title: prev[module.id]?.title || '',
                                    description: prev[module.id]?.description || '',
                                    panda_video_url: prev[module.id]?.panda_video_url || '',
                                    order_index: Number(e.target.value),
                                    published: prev[module.id]?.published || false,
                                  },
                                }))
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!newLessonByModule[module.id]?.published}
                              onChange={(e) =>
                                setNewLessonByModule((prev) => ({
                                  ...prev,
                                  [module.id]: {
                                    title: prev[module.id]?.title || '',
                                    description: prev[module.id]?.description || '',
                                    panda_video_url: prev[module.id]?.panda_video_url || '',
                                    order_index: prev[module.id]?.order_index || 1,
                                    published: e.target.checked,
                                  },
                                }))
                              }
                            />
                            Publicado
                          </label>
                          <button
                            type="button"
                            onClick={() => handleCreateLesson(module.id)}
                            className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm"
                          >
                            Adicionar aula
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Adicionar módulo</p>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
                    <input
                      value={newModule.title}
                      onChange={(e) => setNewModule((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Título do módulo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={newModule.order_index}
                      onChange={(e) => setNewModule((prev) => ({ ...prev, order_index: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Ordem"
                    />
                    <button
                      type="button"
                      onClick={handleCreateModule}
                      className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm"
                    >
                      Adicionar módulo
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminContent;
