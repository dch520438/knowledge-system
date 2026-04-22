import { useState, useEffect, useRef, useMemo } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { writingAPI, knowledgeAPI, llmAPI } from '../api'
import Proofread from './Proofread'
import './Writing.css'

// Quill 编辑器配置
const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ],
}

const QUILL_FORMATS = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'script',
  'list',
  'indent',
  'align',
  'blockquote',
  'code-block',
  'link',
  'image',
]

// 搜索引擎配置
const SEARCH_ENGINES = [
  { name: '百度', key: 'baidu', url: 'https://www.baidu.com/s?wd=' },
  { name: '必应', key: 'bing', url: 'https://www.bing.com/search?q=' },
  { name: '搜狗', key: 'sogou', url: 'https://www.sogou.com/web?query=' },
]

// 预设网站（快捷访问）
const PRESET_WEB_SITES = [
  { name: '人民网', url: 'http://www.people.com.cn' },
  { name: '新华网', url: 'http://www.xinhuanet.com' },
  { name: '求是网', url: 'http://www.qstheory.cn' },
  { name: '中国纪检监察网', url: 'http://www.ccdi.gov.cn' },
  { name: '学习强国', url: 'https://www.xuexi.cn' },
  { name: '深言达意', url: 'https://shenyandayi.com' },
  { name: '汉典', url: 'http://www.zdic.net' },
  { name: '写易', url: 'https://www.xieyi.com' },
]

const toProxyUrl = (url) => {
  if (!url) return ''
  return `/api/proxy/web?url=${encodeURIComponent(url)}`
}

function Writing() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formStatus, setFormStatus] = useState('draft')
  const [referencedKnowledge, setReferencedKnowledge] = useState([])
  const [saving, setSaving] = useState(false)

  // 引用知识模态框
  const [refModalVisible, setRefModalVisible] = useState(false)
  const [knowledgeList, setKnowledgeList] = useState([])
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [selectedRefs, setSelectedRefs] = useState([])

  // 搜索知识库面板
  const [kbPanelVisible, setKbPanelVisible] = useState(false)
  const [kbSearchQuery, setKbSearchQuery] = useState('')
  const [kbSearchResults, setKbSearchResults] = useState([])
  const [kbSearching, setKbSearching] = useState(false)
  const [expandedKbId, setExpandedKbId] = useState(null)

  // 导入文件
  const importFileRef = useRef(null)

  // 导出下拉
  const [exportDropdownVisible, setExportDropdownVisible] = useState(false)
  const exportDropdownRef = useRef(null)

  // 网络搜索模态框
  const [webSearchModalVisible, setWebSearchModalVisible] = useState(false)
  const [webSearchQuery, setWebSearchQuery] = useState('')
  const [webSearchEngine, setWebSearchEngine] = useState('baidu')
  const [webSearchUrl, setWebSearchUrl] = useState('')
  const [webSearchIframeKey, setWebSearchIframeKey] = useState(0)
  const [webSearchMaximized, setWebSearchMaximized] = useState(false)
  const [webSearchHistory, setWebSearchHistory] = useState([])
  const [webPageSearchVisible, setWebPageSearchVisible] = useState(false)
  const [webPageSearchQuery, setWebPageSearchQuery] = useState('')

  // Quill 编辑器引用
  const quillRef = useRef(null)

  // 使用 ref 保存最新值用于自动保存
  const autoSaveRef = useRef({ selectedDoc: null, formTitle: '', formContent: '', formStatus: 'draft', referencedKnowledge: [] })

  useEffect(() => {
    autoSaveRef.current = { selectedDoc, formTitle, formContent, formStatus, referencedKnowledge }
  }, [selectedDoc, formTitle, formContent, formStatus, referencedKnowledge])

  // 离开写作页自动保存
  useEffect(() => {
    return () => {
      const { selectedDoc, formTitle, formContent, formStatus, referencedKnowledge } = autoSaveRef.current
      if (selectedDoc && formContent) {
        writingAPI.update(selectedDoc.id, {
          title: formTitle,
          content: formContent,
          status: formStatus,
          references: referencedKnowledge,
        }).catch(() => {})
      }
    }
  }, [])

  // 核稿
  const [proofreadVisible, setProofreadVisible] = useState(false)
  const [highlightRanges, setHighlightRanges] = useState([])

  // 文稿内部搜索
  const [docSearchVisible, setDocSearchVisible] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docSearchIndex, setDocSearchIndex] = useState(0)
  const [docSearchCount, setDocSearchCount] = useState(0)
  const [docReplaceQuery, setDocReplaceQuery] = useState('')
  const [docReplaceAll, setDocReplaceAll] = useState(false)
  const [selectedTextStats, setSelectedTextStats] = useState(null)

  // 大模型写作功能
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmResult, setLlmResult] = useState('')
  const [llmResultVisible, setLlmResultVisible] = useState(false)

  // AI写作（素材+提纲）
  const [aiComposeVisible, setAiComposeVisible] = useState(false)
  const [aiComposeOutline, setAiComposeOutline] = useState('')
  const [aiComposeStyle, setAiComposeStyle] = useState('formal')
  const [aiComposeLength, setAiComposeLength] = useState('medium')
  const [aiComposeMaterials, setAiComposeMaterials] = useState([])
  const [aiComposeLoading, setAiComposeLoading] = useState(false)
  const [aiComposeResult, setAiComposeResult] = useState('')
    const [composeKnowledgeItems, setComposeKnowledgeItems] = useState([])
    const [composeKnowledgeSearch, setComposeKnowledgeSearch] = useState('')

  // 字数统计
  const wordStats = useMemo(() => {
    const text = formContent.replace(/<[^>]*>/g, '') // 去除 HTML 标签
    const charCount = text.length
    const charCountNoSpace = text.replace(/\s/g, '').length
    // 段落统计：按 <p> 标签计数更准确
    const pCount = (formContent.match(/<p[\s>]/g) || []).length
    // 如果没有 <p> 标签但有换行符，按换行符统计
    const brCount = (formContent.match(/<br\s*\/?>/g) || []).length
    const paragraphs = pCount > 0 ? pCount : (brCount > 0 ? brCount + 1 : (text.trim() ? 1 : 0))
    // 中文字数统计：中文字符 + 英文单词数
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const wordCount = chineseChars + englishWords
    return { charCount, charCountNoSpace, paragraphs, wordCount, chineseChars }
  }, [formContent])

  useEffect(() => {
    fetchDocuments()
  }, [])

  // 监听编辑器选区变化，统计选中内容字数
  useEffect(() => {
    // 延迟绑定，确保 Quill 编辑器已初始化
    const timer = setTimeout(() => {
      const editor = quillRef.current?.getEditor()
      if (!editor) return

      const handleSelectionChange = () => {
        try {
          const selection = editor.getSelection()
          if (selection && selection.length > 0) {
            const text = editor.getText(selection.index, selection.length) || ''
            const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
            const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
            const totalChars = text.replace(/\s/g, '').length
            setSelectedTextStats({
              chineseChars,
              englishWords,
              totalChars,
              total: chineseChars + englishWords,
            })
          } else {
            setSelectedTextStats(null)
          }
        } catch (e) {
          // 忽略选区变化时的错误
        }
      }

      editor.on('selection-change', handleSelectionChange)
    }, 500)

    return () => {
      clearTimeout(timer)
      const editor = quillRef.current?.getEditor()
      if (editor) {
        try {
          // 移除所有 selection-change 监听器
          editor.off('selection-change')
        } catch (e) {}
      }
    }
  }, [selectedDoc])

  // 点击外部关闭导出下拉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const data = await writingAPI.getAll()
      setDocuments(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('获取文档列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDoc = async () => {
    try {
      const newDoc = await writingAPI.create({
        title: '未命名文档',
        content: '',
        status: 'draft',
        references: [],
      })
      setDocuments([newDoc, ...documents])
      selectDocument(newDoc)
    } catch (err) {
      alert(`创建文档失败: ${err.message}`)
    }
  }

  const selectDocument = (doc) => {
    setSelectedDoc(doc)
    setFormTitle(doc.title || '')
    setFormContent(doc.content || '')
    setFormStatus(doc.status || 'draft')
    setReferencedKnowledge(
      Array.isArray(doc.references) ? doc.references : []
    )
  }

  const handleSave = async () => {
    if (!selectedDoc) return
    setSaving(true)
    try {
      const updated = await writingAPI.update(selectedDoc.id, {
        title: formTitle,
        content: formContent,
        status: formStatus,
        references: referencedKnowledge,
      })
      setDocuments(
        documents.map((d) => (d.id === updated.id ? updated : d))
      )
      setSelectedDoc(updated)
      alert('保存成功')
    } catch (err) {
      alert(`保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDoc = async (doc, e) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除「${doc.title}」吗？`)) return
    try {
      await writingAPI.delete(doc.id)
      setDocuments(documents.filter((d) => d.id !== doc.id))
      if (selectedDoc && selectedDoc.id === doc.id) {
        setSelectedDoc(null)
        setFormTitle('')
        setFormContent('')
        setFormStatus('draft')
        setReferencedKnowledge([])
      }
    } catch (err) {
      alert(`删除失败: ${err.message}`)
    }
  }

  // ========== 引用知识库模态框 ==========
  const openRefModal = async () => {
    setRefModalVisible(true)
    setKnowledgeSearch('')
    setSelectedRefs([...referencedKnowledge])
    try {
      const data = await knowledgeAPI.getAll()
      setKnowledgeList(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('获取知识库失败:', err)
    }
  }

  const handleKnowledgeSearch = async () => {
    try {
      const params = {}
      if (knowledgeSearch) params.search = knowledgeSearch
      const data = await knowledgeAPI.getAll(params)
      setKnowledgeList(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('搜索知识库失败:', err)
    }
  }

  const toggleRefSelection = (item) => {
    setSelectedRefs((prev) => {
      const exists = prev.find((r) => r.id === item.id)
      if (exists) {
        return prev.filter((r) => r.id !== item.id)
      }
      return [...prev, item]
    })
  }

  const confirmRefSelection = () => {
    setReferencedKnowledge(selectedRefs)
    setRefModalVisible(false)
  }

  const removeReference = (id) => {
    setReferencedKnowledge(referencedKnowledge.filter((r) => r.id !== id))
  }

  // ========== 搜索知识库面板 ==========
  const toggleKbPanel = () => {
    setKbPanelVisible(!kbPanelVisible)
    if (!kbPanelVisible) {
      setKbSearchQuery('')
      setKbSearchResults([])
    }
  }

  const handleKbPanelSearch = async () => {
    if (!kbSearchQuery.trim()) return
    setKbSearching(true)
    try {
      const params = {}
      if (kbSearchQuery) params.keyword = kbSearchQuery
      const data = await knowledgeAPI.search(params)
      setKbSearchResults(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('搜索知识库失败:', err)
    } finally {
      setKbSearching(false)
    }
  }

  const handleInsertKnowledge = (item) => {
    const quillEditor = quillRef.current?.getEditor()
    if (quillEditor) {
      const range = quillEditor.getSelection(true)
      quillEditor.insertText(range.index, item.content || '')
      quillEditor.setSelection(range.index + (item.content || '').length)
      // 更新内容
      setFormContent(quillEditor.root.innerHTML)
    }
  }

  const toggleKbDetail = (id) => {
    setExpandedKbId(expandedKbId === id ? null : id)
  }

  // ========== 导入文档 ==========
  const handleImportDoc = () => {
    importFileRef.current?.click()
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const newDoc = await writingAPI.importFromFile(file)
      setDocuments([newDoc, ...documents])
      selectDocument(newDoc)
      alert('导入成功')
    } catch (err) {
      alert(`导入失败: ${err.message}`)
    }
    e.target.value = ''
  }

  // ========== 导出文档 ==========
  const handleExportDoc = async (format) => {
    setExportDropdownVisible(false)
    if (!selectedDoc) return
    try {
      await writingAPI.exportDoc(selectedDoc.id, format)
    } catch (err) {
      alert(`导出失败: ${err.message}`)
    }
  }

  // ========== 网络搜索 ==========
  const handleWebSearch = () => {
    if (!webSearchQuery.trim()) return
    const engine = SEARCH_ENGINES.find(e => e.key === webSearchEngine) || SEARCH_ENGINES[0]
    const url = engine.url + encodeURIComponent(webSearchQuery.trim())
    // 保存当前URL到历史
    if (webSearchUrl) {
      setWebSearchHistory(prev => [...prev, webSearchUrl])
    }
    setWebSearchUrl(url)
    setWebSearchIframeKey(prev => prev + 1)
  }

  // 打开预设网站
  const handleOpenPresetSite = (site) => {
    if (webSearchUrl) {
      setWebSearchHistory(prev => [...prev, webSearchUrl])
    }
    setWebSearchUrl(site.url)
    setWebSearchIframeKey(prev => prev + 1)
  }

  const handleWebSearchGoBack = () => {
    if (webSearchHistory.length === 0) return
    const prevHistory = [...webSearchHistory]
    const prevUrl = prevHistory.pop()
    setWebSearchHistory(prevHistory)
    setWebSearchUrl(prevUrl)
    setWebSearchIframeKey(prev => prev + 1)
  }

  // 获取iframe中选中的文本
  const getIframeSelection = () => {
    try {
      const iframe = document.querySelector('.w-modal-websearch iframe')
      if (iframe && iframe.contentWindow) {
        const selection = iframe.contentWindow.getSelection()
        const text = selection ? selection.toString().trim() : ''
        if (text) return text
      }
    } catch (e) {
      // 跨域限制
    }
    // 备选：让用户粘贴
    const text = prompt('请在搜索结果中复制内容，然后粘贴到此处：')
    return text ? text.trim() : ''
  }

  // 插入选中内容到文稿
  const handleInsertSelection = () => {
    const text = getIframeSelection()
    if (!text) {
      alert('请先在搜索结果中选中要插入的内容')
      return
    }
    if (quillRef.current) {
      const editor = quillRef.current.getEditor()
      const index = editor.getSelection()?.index || editor.getLength()
      editor.insertText(index, text)
      alert('内容已插入到文稿中')
    }
  }

  // 添加选中内容到知识库
  const handleAddSelectionToKnowledge = async () => {
    const text = getIframeSelection()
    if (!text) {
      alert('请先在搜索结果中选中要添加的内容')
      return
    }
    const title = text.substring(0, 50) + (text.length > 50 ? '...' : '')
    try {
      await knowledgeAPI.create({ title, content: text })
      alert('内容已添加到知识库')
    } catch (err) {
      alert('添加失败: ' + err.message)
    }
  }

  // 页面内搜索
  const handleWebPageSearch = () => {
    if (!webPageSearchQuery.trim()) return
    try {
      const iframe = document.querySelector('.w-modal-websearch iframe')
      if (iframe && iframe.contentWindow) {
        const win = iframe.contentWindow
        // 使用 window.find 在 iframe 中搜索
        win.find(webPageSearchQuery, false, false, true)
      }
    } catch (e) {
      // 跨域限制，无法搜索
      alert('由于跨域限制，无法在代理页面中搜索。请使用浏览器 Ctrl+F 功能。')
    }
  }

  // ========== 核稿跳转 ==========
  const handleProofreadJump = (start, end) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor()
      editor.setSelection(start, end - start)
      editor.scrollIntoView()
    }
  }

  const handleProofreadCheck = (errors) => {
    setHighlightRanges(errors.map(err => ({
      start: err.start,
      end: err.end,
      severity: err.severity,
    })))
    
    // 在 Quill 编辑器中高亮显示错误
    if (quillRef.current && errors.length > 0) {
      const editor = quillRef.current.getEditor()
      // 先清除所有高亮
      const len = editor.getLength()
      editor.formatText(0, len, { background: false })
      // 保存当前选区
      const savedSelection = editor.getSelection()
      // 使用 format 来高亮
      errors.forEach(err => {
        try {
          const start = Math.max(0, err.start)
          const end = Math.min(err.end, len - 1)
          if (start < end) {
            const color = err.severity === 'error' ? '#ffccc7' : err.severity === 'warning' ? '#fff1b8' : '#91d5ff'
            editor.formatText(start, end - start, 'background', color)
          }
        } catch (e) {
          // 位置可能不准确，跳过
        }
      })
      // 恢复选区
      if (savedSelection) {
        try {
          editor.setSelection(savedSelection)
        } catch (e) {}
      }
    }
  }

  const clearProofreadHighlights = () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor()
      const len = editor.getLength()
      editor.formatText(0, len, 'background', false)
    }
    setHighlightRanges([])
  }

  // ========== 文稿内部搜索 ==========
  const handleDocSearch = () => {
    if (!quillRef.current || !docSearchQuery.trim()) {
      setDocSearchCount(0)
      setDocSearchIndex(0)
      return
    }
    const editor = quillRef.current.getEditor()
    const text = editor.getText()
    const query = docSearchQuery.trim()
    const indices = []
    let pos = text.indexOf(query)
    while (pos !== -1) {
      indices.push(pos)
      pos = text.indexOf(query, pos + 1)
    }
    setDocSearchCount(indices.length)
    if (indices.length === 0) {
      setDocSearchIndex(0)
      return
    }
    const idx = docSearchIndex % indices.length
    setDocSearchIndex(idx + 1)
    const start = indices[idx]
    editor.setSelection(start, query.length)
    editor.scrollIntoView()
  }

  const handleDocSearchPrev = () => {
    if (docSearchCount === 0) return
    const newIndex = ((docSearchIndex - 2) + docSearchCount) % docSearchCount
    setDocSearchIndex(newIndex + 1)
    if (quillRef.current) {
      const editor = quillRef.current.getEditor()
      const text = editor.getText()
      const query = docSearchQuery.trim()
      const indices = []
      let pos = text.indexOf(query)
      while (pos !== -1) {
        indices.push(pos)
        pos = text.indexOf(query, pos + 1)
      }
      if (indices[newIndex] !== undefined) {
        editor.setSelection(indices[newIndex], query.length)
        editor.scrollIntoView()
      }
    }
  }

  const handleDocSearchNext = () => {
    handleDocSearch()
  }

  // 替换当前匹配
  const handleDocReplace = () => {
    if (!quillRef.current || !docSearchQuery.trim()) return
    const editor = quillRef.current.getEditor()
    const selection = editor.getSelection()
    if (!selection || selection.length === 0) {
      // 没有选中内容，先搜索定位
      handleDocSearch()
      return
    }
    // 检查选中的内容是否匹配搜索词
    const selectedText = editor.getText(selection.index, selection.length)
    if (selectedText === docSearchQuery.trim()) {
      editor.deleteText(selection.index, selection.length)
      editor.insertText(selection.index, docReplaceQuery)
      // 更新 formContent
      setFormContent(editor.root.innerHTML)
      // 自动跳到下一个
      handleDocSearch()
    } else {
      handleDocSearch()
    }
  }

  // 替换全部匹配
  const handleDocReplaceAll = () => {
    if (!quillRef.current || !docSearchQuery.trim()) return
    const editor = quillRef.current.getEditor()
    const text = editor.getText()
    const query = docSearchQuery.trim()
    const replace = docReplaceQuery
    let count = 0
    let pos = text.indexOf(query)
    while (pos !== -1) {
      count++
      pos = text.indexOf(query, pos + 1)
    }
    if (count === 0) return
    if (!confirm(`确定要替换全部 ${count} 处匹配吗？`)) return
    
    // 使用 Quill 的 getText/setText 进行替换
    const newText = text.split(query).join(replace)
    editor.setText(newText)
    setFormContent(editor.root.innerHTML)
    setDocSearchCount(0)
    setDocSearchIndex(0)
  }

  // ========== 大模型写作功能 ==========
  const handleLLMWriting = async (action) => {
    const editor = quillRef.current
    if (!editor) return
    const text = editor.getText().trim()
    if (!text) { alert('请先输入内容'); return }

    setLlmLoading(true)
    setLlmResult('')
    try {
      const result = await llmAPI.writing(action, text)
      setLlmResult(result.content)
      setLlmResultVisible(true)
    } catch (err) {
      if (err.message.includes('未配置')) {
        alert('请先在设置中配置并激活大模型')
      } else {
        alert('AI处理失败: ' + err.message)
      }
    } finally {
      setLlmLoading(false)
    }
  }

  const insertLlmResult = () => {
    if (!llmResult || !quillRef.current) return
    const editor = quillRef.current.getEditor()
    const pos = editor.getSelection()?.index || editor.getLength()
    editor.insertText(pos, llmResult)
    setLlmResultVisible(false)
    setLlmResult('')
  }

  const replaceWithLlmResult = () => {
    if (!llmResult || !quillRef.current) return
    const editor = quillRef.current.getEditor()
    const selection = editor.getSelection()
    if (selection && selection.length > 0) {
      editor.deleteText(selection.index, selection.length)
      editor.insertText(selection.index, llmResult)
    } else {
      editor.setText(llmResult)
    }
    setLlmResultVisible(false)
    setLlmResult('')
  }

  // AI写作 - 获取知识库列表
  const fetchKnowledgeForCompose = async () => {
    try {
      const { knowledgeAPI } = await import('../api')
      let data
      if (composeKnowledgeSearch.trim()) {
        data = await knowledgeAPI.search({ keyword: composeKnowledgeSearch.trim() })
      } else {
        data = await knowledgeAPI.getAll()
      }
      setComposeKnowledgeItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('获取知识库失败:', err)
    }
  }

  // AI写作 - 切换素材选择
  const toggleMaterial = (item) => {
    setAiComposeMaterials(prev => {
      if (prev.find(m => m.id === item.id)) {
        return prev.filter(m => m.id !== item.id)
      }
      return [...prev, item]
    })
  }

  // AI写作 - 执行写作
  const handleAICompose = async () => {
    if (!aiComposeOutline.trim()) {
      alert('请输入写作提纲或要求')
      return
    }
    setAiComposeLoading(true)
    setAiComposeResult('')
    try {
      const result = await llmAPI.compose(
        aiComposeMaterials.map(m => m.id),
        aiComposeOutline,
        aiComposeStyle,
        aiComposeLength
      )
      setAiComposeResult(result.content)
    } catch (err) {
      if (err.message.includes('未配置')) {
        alert('请先在设置中配置并激活大模型')
      } else {
        alert('AI写作失败: ' + err.message)
      }
    } finally {
      setAiComposeLoading(false)
    }
  }

  // AI写作 - 插入结果到编辑器
  const insertComposeResult = () => {
    if (!aiComposeResult || !quillRef.current) return
    const editor = quillRef.current.getEditor()
    const pos = editor.getSelection()?.index || editor.getLength()
    editor.insertText(pos, aiComposeResult)
    setAiComposeVisible(false)
    setAiComposeResult('')
    setAiComposeOutline('')
    setAiComposeMaterials([])
  }

  // AI写作 - 替换编辑器内容
  const replaceWithComposeResult = () => {
    if (!aiComposeResult || !quillRef.current) return
    const editor = quillRef.current.getEditor()
    editor.setText(aiComposeResult)
    setAiComposeVisible(false)
    setAiComposeResult('')
    setAiComposeOutline('')
    setAiComposeMaterials([])
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="writing">
      <div className="writing-container">
        {/* 左侧文档列表 */}
        <div className="writing-sidebar">
          <div className="writing-sidebar-header">
            <h3>文档列表</h3>
            <button className="w-btn w-btn-primary" onClick={handleCreateDoc}>
              + 新建文档
            </button>
          </div>
          <div className="writing-doc-list">
            {loading ? (
              <div className="writing-loading">加载中...</div>
            ) : documents.length === 0 ? (
              <div className="writing-empty">暂无文档</div>
            ) : (
              documents.map((doc) => (
                <div
                  className={`writing-doc-item ${
                    selectedDoc && selectedDoc.id === doc.id ? 'active' : ''
                  }`}
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                >
                  <div className="writing-doc-title">{doc.title}</div>
                  <div className="writing-doc-meta">
                    <span
                      className={`writing-doc-status ${
                        doc.status === 'published'
                          ? 'status-published'
                          : 'status-draft'
                      }`}
                    >
                      {doc.status === 'published' ? '已发布' : '草稿'}
                    </span>
                    <span className="writing-doc-time">
                      {formatDate(doc.updated_at || doc.updatedAt)}
                    </span>
                  </div>
                  <button
                    className="writing-doc-delete"
                    onClick={(e) => handleDeleteDoc(doc, e)}
                    title="删除"
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="writing-editor-area">
          {selectedDoc ? (
            <>
              <div className="writing-editor-header">
                <input
                  type="text"
                  className="writing-title-input"
                  placeholder="请输入文档标题"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
                <div className="writing-editor-actions">
                  <button
                    className="w-btn w-btn-default"
                    onClick={openRefModal}
                  >
                    引用知识库
                  </button>
                  <button
                    className="w-btn w-btn-default"
                    onClick={toggleKbPanel}
                  >
                    {kbPanelVisible ? '收起知识搜索' : '搜索知识库'}
                  </button>
                  <button
                    className="w-btn w-btn-default"
                    onClick={() => { setDocSearchVisible(!docSearchVisible); setDocSearchQuery(''); setDocSearchIndex(0); setDocSearchCount(0); }}
                  >
                    🔍 文稿搜索
                  </button>
                  <button className="w-btn w-btn-default" onClick={() => setWebSearchModalVisible(true)}>
                    网络搜索
                  </button>
                  <button className="w-btn w-btn-default" onClick={() => setProofreadVisible(!proofreadVisible)}>
                    核稿
                  </button>
                  <span className="toolbar-separator" />
                  <button className="w-btn" onClick={() => handleLLMWriting('polish')} disabled={llmLoading} title="AI润色">✨润色</button>
                  <button className="w-btn" onClick={() => handleLLMWriting('continue')} disabled={llmLoading} title="AI续写">✍️续写</button>
                  <button className="w-btn" onClick={() => handleLLMWriting('summarize')} disabled={llmLoading} title="AI总结">📝总结</button>
                  <button className="w-btn" onClick={() => handleLLMWriting('expand')} disabled={llmLoading} title="AI扩写">📐扩写</button>
                  <button className="w-btn" onClick={() => { setAiComposeVisible(true); fetchKnowledgeForCompose(); }} title="AI写作（素材+提纲）">📋AI写作</button>
                  <button
                    className="w-btn w-btn-default"
                    onClick={handleImportDoc}
                  >
                    导入文档
                  </button>
                  <div className="w-export-wrapper" ref={exportDropdownRef}>
                    <button
                      className="w-btn w-btn-default"
                      onClick={() => setExportDropdownVisible(!exportDropdownVisible)}
                    >
                      导出 ▼
                    </button>
                    {exportDropdownVisible && (
                      <div className="w-export-dropdown">
                        <button onClick={() => handleExportDoc('docx')}>导出 DOCX</button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`w-btn ${
                      formStatus === 'published'
                        ? 'w-btn-success'
                        : 'w-btn-warning'
                    }`}
                    onClick={() =>
                      setFormStatus(
                        formStatus === 'published' ? 'draft' : 'published'
                      )
                    }
                  >
                    {formStatus === 'published' ? '已发布' : '草稿'}
                  </button>
                  <button
                    className="w-btn w-btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>

              {/* 编辑器主体 + 知识搜索面板 + 核稿面板 */}
              <div className="writing-editor-body">
                <div style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
                  {/* 编辑器区域 */}
                  <div className="writing-editor-main">
                    {/* 文稿内部搜索栏 */}
                    {docSearchVisible && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', flexShrink: 0}}>
                        {/* 搜索行 */}
                        <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                          <input
                            type="text"
                            placeholder="搜索..."
                            value={docSearchQuery}
                            onChange={(e) => { setDocSearchQuery(e.target.value); setDocSearchIndex(0); setDocSearchCount(0); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleDocSearch(); if (e.key === 'Escape') setDocSearchVisible(false); }}
                            autoFocus
                            style={{flex: 1, height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '13px'}}
                          />
                          <button className="w-btn w-btn-sm w-btn-primary" onClick={handleDocSearch} style={{padding: '0 8px'}}>搜索</button>
                          <button className="w-btn w-btn-sm w-btn-default" onClick={handleDocSearchPrev} disabled={docSearchCount === 0} title="上一个">↑</button>
                          <button className="w-btn w-btn-sm w-btn-default" onClick={handleDocSearchNext} disabled={docSearchCount === 0} title="下一个">↓</button>
                          <span style={{fontSize: '12px', color: '#999', whiteSpace: 'nowrap', minWidth: '40px', textAlign: 'center'}}>
                            {docSearchCount > 0 ? `${((docSearchIndex - 1 + docSearchCount) % docSearchCount) + 1}/${docSearchCount}` : docSearchQuery ? '无结果' : ''}
                          </span>
                          <button className="w-btn w-btn-sm w-btn-default" onClick={() => setDocSearchVisible(false)}>✕</button>
                        </div>
                        {/* 替换行 */}
                        <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                          <input
                            type="text"
                            placeholder="替换为..."
                            value={docReplaceQuery}
                            onChange={(e) => setDocReplaceQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleDocReplace(); }}
                            style={{flex: 1, height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '13px'}}
                          />
                          <button className="w-btn w-btn-sm w-btn-primary" onClick={handleDocReplace} disabled={!docSearchQuery.trim()}>替换</button>
                          <button className="w-btn w-btn-sm w-btn-primary" onClick={handleDocReplaceAll} disabled={!docSearchQuery.trim()}>全部替换</button>
                        </div>
                      </div>
                    )}
                    <div className="writing-quill-wrapper">
                      <ReactQuill
                        ref={quillRef}
                        theme="snow"
                        value={formContent}
                        onChange={(value) => setFormContent(value)}
                        modules={QUILL_MODULES}
                        formats={QUILL_FORMATS}
                        placeholder="请输入文档内容..."
                      />
                    </div>
                    {/* 字数统计 */}
                    <div className="writing-word-stats">
                      <span>中文字数：{wordStats.chineseChars}</span>
                      <span>总字数：{wordStats.wordCount}</span>
                      <span>字符数（含空格）：{wordStats.charCount}</span>
                      <span>字符数（不含空格）：{wordStats.charCountNoSpace}</span>
                      <span>段落数：{wordStats.paragraphs}</span>
                      {selectedTextStats && (
                        <span style={{color: '#1890ff'}}>
                          已选 {selectedTextStats.chineseChars} 中文字 / {selectedTextStats.total} 字
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 核稿面板 */}
                  {proofreadVisible && (
                    <div style={{width: '350px', flexShrink: 0}}>
                      <Proofread
                        content={formContent}
                        onJumpToPosition={handleProofreadJump}
                        onCheck={handleProofreadCheck}
                        onClearHighlights={clearProofreadHighlights}
                      />
                    </div>
                  )}
                </div>

                {/* 搜索知识库面板 */}
                {kbPanelVisible && (
                  <div className="writing-kb-panel">
                    <div className="writing-kb-panel-header">
                      <h4>搜索知识库</h4>
                      <button
                        className="w-btn w-btn-sm w-btn-link"
                        onClick={toggleKbPanel}
                      >
                        收起
                      </button>
                    </div>
                    <div className="writing-kb-panel-search">
                      <input
                        type="text"
                        className="w-search-input"
                        placeholder="输入关键词搜索..."
                        value={kbSearchQuery}
                        onChange={(e) => setKbSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleKbPanelSearch()}
                        autoComplete="off"
                        autoCorrect="off"
                      />
                      <button
                        className="w-btn w-btn-primary"
                        onClick={handleKbPanelSearch}
                        disabled={kbSearching}
                      >
                        {kbSearching ? '搜索中...' : '搜索'}
                      </button>
                    </div>
                    <div className="writing-kb-panel-results">
                      {kbSearchResults.length === 0 ? (
                        <div className="writing-kb-panel-empty">
                          {kbSearchQuery ? '未找到相关知识' : '请输入关键词搜索'}
                        </div>
                      ) : (
                        kbSearchResults.map((item) => (
                          <div className="writing-kb-panel-item" key={item.id}>
                            <div className="writing-kb-panel-item-header">
                              <span className="writing-kb-panel-item-title">
                                {item.title}
                              </span>
                              <div className="writing-kb-panel-item-actions">
                                <button
                                  className="w-btn w-btn-sm w-btn-primary"
                                  onClick={() => handleInsertKnowledge(item)}
                                >
                                  插入
                                </button>
                                <button
                                  className="w-btn w-btn-sm w-btn-default"
                                  onClick={() => toggleKbDetail(item.id)}
                                >
                                  {expandedKbId === item.id ? '收起' : '详情'}
                                </button>
                              </div>
                            </div>
                            <div className="writing-kb-panel-item-summary">
                              {(item.content || '').substring(0, 80)}
                              {(item.content || '').length > 80 ? '...' : ''}
                            </div>
                            {expandedKbId === item.id && (
                              <div className="writing-kb-panel-item-detail">
                                {item.content || '暂无内容'}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 已引用知识 */}
              {referencedKnowledge.length > 0 && (
                <div className="writing-references">
                  <h4>引用的知识</h4>
                  <div className="writing-ref-list">
                    {referencedKnowledge.map((ref) => (
                      <div className="writing-ref-tag" key={ref.id}>
                        <span className="writing-ref-title">{ref.title}</span>
                        <button
                          className="writing-ref-remove"
                          onClick={() => removeReference(ref.id)}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="writing-no-selection">
              <div className="writing-no-selection-icon">📝</div>
              <p>请选择或新建一个文档开始编辑</p>
            </div>
          )}
        </div>
      </div>

      {/* 隐藏的文件导入 input */}
      <input
        type="file"
        ref={importFileRef}
        style={{ display: 'none' }}
        accept=".docx,.txt"
        onChange={handleImportFileChange}
      />

      {/* 引用知识模态框 */}
      {refModalVisible && (
        <div
          className="w-modal-overlay"
          onClick={() => setRefModalVisible(false)}
        >
          <div className="w-modal" onClick={(e) => e.stopPropagation()}>
            <div className="w-modal-header">
              <h2>引用知识库</h2>
              <button
                className="w-modal-close"
                onClick={() => setRefModalVisible(false)}
              >
                x
              </button>
            </div>
            <div className="w-modal-body">
              <div className="w-search-bar">
                <input
                  type="text"
                  className="w-search-input"
                  placeholder="搜索知识库..."
                  value={knowledgeSearch}
                  onChange={(e) => setKnowledgeSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleKnowledgeSearch()}
                  autoComplete="off"
                  autoCorrect="off"
                />
                <button
                  className="w-btn w-btn-primary"
                  onClick={handleKnowledgeSearch}
                >
                  搜索
                </button>
              </div>
              <div className="w-knowledge-list">
                {knowledgeList.map((item) => {
                  const isSelected = selectedRefs.find(
                    (r) => r.id === item.id
                  )
                  return (
                    <div
                      className={`w-knowledge-item ${isSelected ? 'selected' : ''}`}
                      key={item.id}
                      onClick={() => toggleRefSelection(item)}
                    >
                      <div className="w-knowledge-check">
                        {isSelected ? '☑' : '☐'}
                      </div>
                      <div className="w-knowledge-info">
                        <div className="w-knowledge-title">{item.title}</div>
                        <div className="w-knowledge-summary">
                          {(item.content || '').substring(0, 60)}
                          {(item.content || '').length > 60 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="w-modal-footer">
              <button
                className="w-btn w-btn-default"
                onClick={() => setRefModalVisible(false)}
              >
                取消
              </button>
              <button className="w-btn w-btn-primary" onClick={confirmRefSelection}>
                确认引用 ({selectedRefs.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 网络搜索模态框 */}
      {webSearchModalVisible && (
        <div className="w-modal-overlay" onClick={() => setWebSearchModalVisible(false)}>
          <div className={`w-modal w-modal-websearch ${webSearchMaximized ? 'w-modal-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="w-modal-header">
              <h2>网络搜索</h2>
              <div style={{display: 'flex', gap: '8px'}}>
                <button 
                  className="w-btn w-btn-sm w-btn-default" 
                  onClick={() => setWebSearchMaximized(!webSearchMaximized)}
                  title={webSearchMaximized ? '还原' : '最大化'}
                >
                  {webSearchMaximized ? '❐' : '⬜'}
                </button>
                <button className="w-modal-close" onClick={() => setWebSearchModalVisible(false)}>x</button>
              </div>
            </div>
            <div className="w-modal-body" style={{padding: 0, display: 'flex', flexDirection: 'column', height: '75vh'}}>
              <div style={{display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap'}}>
                <button
                  className="w-btn w-btn-default"
                  onClick={handleWebSearchGoBack}
                  disabled={webSearchHistory.length === 0}
                  title="返回上一页"
                >
                  &larr; 返回
                </button>
                <select value={webSearchEngine} onChange={(e) => setWebSearchEngine(e.target.value)} style={{height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px'}}>
                  {SEARCH_ENGINES.map(e => <option key={e.key} value={e.key}>{e.name}</option>)}
                </select>
                <input type="text" className="w-search-input" placeholder="输入搜索关键词..." value={webSearchQuery} onChange={(e) => setWebSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()} autoComplete="off" style={{flex: 1, minWidth: '150px'}} />
                <button className="w-btn w-btn-primary" onClick={handleWebSearch}>搜索</button>
                {webSearchUrl && (
                  <button className="w-btn w-btn-default" onClick={() => window.open(webSearchUrl, '_self')}>
                    当前标签页打开
                  </button>
                )}
                <button className="w-btn w-btn-default" onClick={() => setWebPageSearchVisible(!webPageSearchVisible)}>
                  🔍 页面搜索
                </button>
              </div>
              {/* 预设网站快捷按钮 */}
              <div style={{display: 'flex', gap: '4px', padding: '4px 16px', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0'}}>
                {PRESET_WEB_SITES.map(site => (
                  <button
                    key={site.name}
                    className="w-btn w-btn-sm"
                    style={{fontSize: '12px', padding: '2px 8px', border: '1px solid #d0d0d0', borderRadius: '3px', background: webSearchUrl === site.url ? '#0070c0' : '#fff', color: webSearchUrl === site.url ? '#fff' : '#333', cursor: 'pointer'}}
                    onClick={() => handleOpenPresetSite(site)}
                  >
                    {site.name}
                  </button>
                ))}
              </div>
              <div style={{padding: '8px 16px', background: '#fffbe6', borderBottom: '1px solid #ffe58f', fontSize: '12px', color: '#d48806'}}>
                提示：部分搜索引擎可能禁止嵌入加载，如无法显示请点击"在新窗口打开"
              </div>
              {/* 页面内搜索 */}
              {webPageSearchVisible && (
                <div style={{display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, alignItems: 'center', background: '#f0f5ff'}}>
                  <input
                    type="text"
                    placeholder="在当前页面中搜索..."
                    value={webPageSearchQuery}
                    onChange={(e) => setWebPageSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleWebPageSearch() }}
                    style={{flex: 1, height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '13px'}}
                  />
                  <button className="w-btn w-btn-sm w-btn-primary" onClick={handleWebPageSearch}>查找</button>
                  <button className="w-btn w-btn-sm w-btn-default" onClick={() => setWebPageSearchVisible(false)}>✕</button>
                </div>
              )}
              <div style={{flex: 1, position: 'relative'}}>
                {webSearchUrl ? (
                  <div style={{width: '100%', height: '100%', position: 'relative'}}>
                    <iframe
                      key={webSearchIframeKey}
                      src={webSearchUrl}
                      style={{width: '100%', height: '100%', border: 'none'}}
                      title="网络搜索"
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"
                    />
                    <div style={{position: 'absolute', bottom: '4px', right: '8px', zIndex: 5}}>
                      <button className="w-btn w-btn-sm w-btn-default" onClick={() => window.open(webSearchUrl, '_self')} style={{fontSize: '11px', opacity: 0.7}}>当前标签页打开</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999'}}>
                    请输入关键词进行搜索
                  </div>
                )}
              </div>
            </div>
            <div className="w-modal-footer" style={{justifyContent: 'space-between'}}>
              <div style={{display: 'flex', gap: '8px'}}>
                <button className="w-btn w-btn-default" onClick={handleInsertSelection}>
                  插入选中内容到文稿
                </button>
                <button className="w-btn w-btn-default" onClick={handleAddSelectionToKnowledge}>
                  添加选中内容到知识库
                </button>
              </div>
              <button className="w-btn w-btn-default" onClick={() => setWebSearchModalVisible(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* AI 结果弹窗 */}
      {llmResultVisible && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: '#fff', borderRadius: '8px', padding: '24px', width: '600px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.15)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <h3 style={{margin: 0, fontSize: '15px'}}>🤖 AI 处理结果</h3>
              <button onClick={() => setLlmResultVisible(false)} style={{background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999'}}>×</button>
            </div>
            <div style={{flex: 1, overflowY: 'auto', padding: '12px', background: '#f9f9f9', borderRadius: '4px', marginBottom: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '14px'}}>
              {llmLoading ? '处理中...' : llmResult}
            </div>
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
              <button className="w-btn w-btn-default" onClick={() => setLlmResultVisible(false)}>取消</button>
              <button className="w-btn w-btn-default" onClick={insertLlmResult}>插入到文末</button>
              <button className="w-btn w-btn-primary" onClick={replaceWithLlmResult}>替换选中内容</button>
            </div>
          </div>
        </div>
      )}

      {/* AI写作弹窗（素材+提纲） */}
      {aiComposeVisible && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: '#fff', borderRadius: '8px', width: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.15)'}}>
            {/* 标题栏 */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'linear-gradient(180deg, #4b8cc8, #3670a8)', color: '#fff', borderRadius: '8px 8px 0 0'}}>
              <h3 style={{margin: 0, fontSize: '15px', fontWeight: 'normal'}}>📋 AI写作 - 素材+提纲</h3>
              <button onClick={() => setAiComposeVisible(false)} style={{background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer'}}>×</button>
            </div>
            
            <div style={{flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', gap: '16px'}}>
              {/* 左侧：素材选择 */}
              <div style={{width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column'}}>
                <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>📚 选择参考素材（{aiComposeMaterials.length}项）</div>
                <input type="text" placeholder="搜索知识库..." value={composeKnowledgeSearch} onChange={(e) => setComposeKnowledgeSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchKnowledgeForCompose()} style={{width: '100%', height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box'}} />
                <div style={{flex: 1, overflowY: 'auto', border: '1px solid #e8e8e8', borderRadius: '4px', background: '#fafafa'}}>
                  {composeKnowledgeItems.length === 0 ? (
                    <div style={{padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px'}}>暂无知识素材</div>
                  ) : (
                    composeKnowledgeItems.map(item => {
                      const selected = aiComposeMaterials.find(m => m.id === item.id)
                      return (
                        <div key={item.id} onClick={() => toggleMaterial(item)} style={{padding: '8px 10px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: selected ? '#e6f7ff' : 'transparent', fontSize: '12px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                            <input type="checkbox" checked={!!selected} readOnly style={{margin: 0}} />
                            <span style={{fontWeight: selected ? 'bold' : 'normal', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{item.title}</span>
                          </div>
                          {selected && (
                            <div style={{marginTop: '4px', color: '#666', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{(item.content || '').substring(0, 60)}...</div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              
              {/* 右侧：提纲和结果 */}
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div>
                  <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>✏️ 写作提纲/要求</div>
                  <textarea value={aiComposeOutline} onChange={(e) => setAiComposeOutline(e.target.value)} placeholder={"请输入写作提纲或要求，例如：\n1. 引言：介绍背景\n2. 主体：分析问题\n3. 结论：总结建议"} style={{width: '100%', height: '120px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px', fontSize: '13px', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'}} />
                </div>
                
                <div style={{display: 'flex', gap: '12px'}}>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#666'}}>写作风格</label>
                    <select value={aiComposeStyle} onChange={(e) => setAiComposeStyle(e.target.value)} style={{width: '100%', height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '12px'}}>
                      <option value="formal">正式公文</option>
                      <option value="casual">通俗易懂</option>
                      <option value="academic">学术论文</option>
                      <option value="news">新闻报道</option>
                    </select>
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: '#666'}}>篇幅</label>
                    <select value={aiComposeLength} onChange={(e) => setAiComposeLength(e.target.value)} style={{width: '100%', height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '12px'}}>
                      <option value="short">短篇（500字）</option>
                      <option value="medium">中篇（1000-1500字）</option>
                      <option value="long">长篇（2000字+）</option>
                    </select>
                  </div>
                </div>
                
                <button className="w-btn w-btn-primary" onClick={handleAICompose} disabled={aiComposeLoading} style={{width: '100%'}}>
                  {aiComposeLoading ? '🤖 AI正在写作中...' : '🤖 开始AI写作'}
                </button>
                
                {aiComposeResult && (
                  <div>
                    <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>📄 写作结果</div>
                    <div style={{border: '1px solid #e8e8e8', borderRadius: '4px', padding: '12px', background: '#fff', maxHeight: '250px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '13px'}}>
                      {aiComposeResult}
                    </div>
                    <div style={{display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end'}}>
                      <button className="w-btn w-btn-sm w-btn-default" onClick={() => setAiComposeResult('')}>清除</button>
                      <button className="w-btn w-btn-sm w-btn-default" onClick={insertComposeResult}>插入到文末</button>
                      <button className="w-btn w-btn-sm w-btn-primary" onClick={replaceWithComposeResult}>替换当前内容</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Writing
