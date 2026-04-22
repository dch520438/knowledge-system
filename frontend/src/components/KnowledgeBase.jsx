import { useState, useEffect, useRef } from 'react'
import { knowledgeAPI, writingAPI } from '../api'
import './KnowledgeBase.css'

// 预置网站快捷按钮
const PRESET_SITES = [
  { name: '人民网', url: 'http://www.people.com.cn' },
  { name: '新华网', url: 'http://www.xinhuanet.com' },
  { name: '求是网', url: 'http://www.qstheory.cn' },
  { name: '中国政府网', url: 'http://www.gov.cn' },
  { name: '百度', url: 'http://www.baidu.com' },
  { name: '必应', url: 'http://www.bing.com' },
  { name: '搜狗', url: 'http://www.sogou.com' },
  { name: '深言达意', url: 'https://shenyandayi.com' },
  { name: '汉典', url: 'http://www.zdic.net' },
  { name: '写易', url: 'https://www.xieyi.com' },
]

const toProxyUrl = (url) => {
  if (!url) return ''
  return `/api/proxy/web?url=${encodeURIComponent(url)}`
}

function KnowledgeBase() {
  const [knowledgeList, setKnowledgeList] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchCategory, setBatchCategory] = useState('')
  const [batchTags, setBatchTags] = useState('')
  const [batchTagMode, setBatchTagMode] = useState('replace')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('') // 'delete' | 'category' | 'tags'
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formTags, setFormTags] = useState('')

  // 网页采集模态框
  const [webModalVisible, setWebModalVisible] = useState(false)
  const [webUrl, setWebUrl] = useState('')
  const [iframeError, setIframeError] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [webHistory, setWebHistory] = useState([])
  const [iframeLoading, setIframeLoading] = useState(false)
  const [iframeLoadError, setIframeLoadError] = useState(false)
  const [webMaximized, setWebMaximized] = useState(false)
  const [webPageSearchVisible, setWebPageSearchVisible] = useState(false)
  const [webPageSearchQuery, setWebPageSearchQuery] = useState('')

  // 从网页内容新建知识子模态框
  const [webContentModalVisible, setWebContentModalVisible] = useState(false)
  const [webContentTitle, setWebContentTitle] = useState('')
  const [webContentText, setWebContentText] = useState('')

  // 从写作文稿新建知识模态框
  const [writingModalVisible, setWritingModalVisible] = useState(false)
  const [writingList, setWritingList] = useState([])
  const [selectedWriting, setSelectedWriting] = useState(null)
  const [writingContent, setWritingContent] = useState('')
  const [writingSelection, setWritingSelection] = useState('')
  const [writingFormTitle, setWritingFormTitle] = useState('')
  const [writingFormCategory, setWritingFormCategory] = useState('')
  const [writingFormTags, setWritingFormTags] = useState('')

  // 批量导出下拉
  const [exportDropdownVisible, setExportDropdownVisible] = useState(false)
  const exportDropdownRef = useRef(null)

  // 文件导入 input ref
  const importFileRef = useRef(null)

  useEffect(() => {
    fetchKnowledge()
    fetchCategories()
  }, [])

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

  const fetchKnowledge = async () => {
    setLoading(true)
    try {
      let data
      if (searchQuery || selectedCategory) {
        const params = {}
        if (searchQuery) params.keyword = searchQuery
        if (selectedCategory) params.category = selectedCategory
        data = await knowledgeAPI.search(params)
      } else {
        data = await knowledgeAPI.getAll()
      }
      setKnowledgeList(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('获取知识库失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const data = await knowledgeAPI.getCategories()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('获取分类失败:', err)
    }
  }

  const handleSearch = () => {
    fetchKnowledge()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      fetchKnowledge()
    }
  }

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value)
  }

  useEffect(() => {
    fetchKnowledge()
  }, [selectedCategory])

  const openCreateModal = () => {
    setEditingItem(null)
    setFormTitle('')
    setFormContent('')
    setFormCategory('')
    setFormTags('')
    setModalVisible(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormTitle(item.title || '')
    setFormContent(item.content || '')
    setFormCategory(item.category || '')
    setFormTags(
      Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || ''
    )
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setEditingItem(null)
  }

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      alert('请输入标题')
      return
    }

    const data = {
      title: formTitle,
      content: formContent,
      category: formCategory || null,
      tags: formTags || null,
    }

    try {
      if (editingItem) {
        await knowledgeAPI.update(editingItem.id, data)
      } else {
        await knowledgeAPI.create(data)
      }
      closeModal()
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert(`操作失败: ${err.message}`)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`确定要删除「${item.title}」吗？`)) {
      return
    }
    try {
      await knowledgeAPI.delete(item.id)
      fetchKnowledge()
    } catch (err) {
      alert(`删除失败: ${err.message}`)
    }
  }

  // ========== 网页采集 ==========
  const openWebModal = () => {
    setWebUrl('')
    setIframeError(false)
    setIframeKey(0)
    setWebHistory([])
    setWebMaximized(false)
    setWebModalVisible(true)
  }

  const closeWebModal = () => {
    setWebModalVisible(false)
    setIframeError(false)
  }

  const handlePresetSiteClick = (url) => {
    // 保存当前URL到历史
    if (webUrl) {
      setWebHistory(prev => [...prev, webUrl])
    }
    setWebUrl(url)
    setIframeError(false)
    setIframeLoading(true)
    setIframeLoadError(false)
    setIframeKey(prev => prev + 1)
  }

  const handleNavigate = () => {
    if (!webUrl.trim()) return
    let url = webUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
      setWebUrl(url)
    }
    setIframeError(false)
    setIframeLoading(true)
    setIframeLoadError(false)
    setIframeKey(prev => prev + 1)
    setWebHistory(prev => [...prev, url])
  }

  const handleWebPageSearch = () => {
    if (!webPageSearchQuery.trim()) return
    try {
      const iframe = document.querySelector('.kb-web-iframe')
      if (iframe && iframe.contentWindow) {
        const win = iframe.contentWindow
        win.find(webPageSearchQuery, false, false, true)
      }
    } catch (e) {
      alert('由于跨域限制，无法在代理页面中搜索。请使用浏览器 Ctrl+F 功能。')
    }
  }

  const handleGoBack = () => {
    if (webHistory.length === 0) return
    const prevHistory = [...webHistory]
    const prevUrl = prevHistory.pop()
    setWebHistory(prevHistory)
    setWebUrl(prevUrl)
    setIframeError(false)
    setIframeLoading(true)
    setIframeLoadError(false)
    setIframeKey(prev => prev + 1)
  }

  const handleIframeLoad = () => {
    setIframeError(false)
  }

  const handleIframeError = () => {
    setIframeError(true)
  }

  // 获取iframe中选中的文本
  const getIframeSelection = () => {
    try {
      const iframe = document.querySelector('.w-modal-websearch iframe, .kb-modal-fullscreen iframe')
      if (iframe && iframe.contentWindow) {
        const selection = iframe.contentWindow.getSelection()
        const text = selection ? selection.toString().trim() : ''
        if (text) return text
      }
    } catch (e) {
      // 跨域限制
    }
    // 备选：让用户粘贴
    const text = prompt('请在网页中复制内容，然后粘贴到此处：')
    return text ? text.trim() : ''
  }

  // 插入选中内容
  const handleInsertSelection = () => {
    const text = getIframeSelection()
    if (!text) {
      alert('请先在网页中选中要插入的内容')
      return
    }
    // 复制到剪贴板
    navigator.clipboard?.writeText(text).then(() => {
      alert('内容已复制到剪贴板，可粘贴到编辑器中')
    }).catch(() => {
      alert('内容已获取，请手动粘贴')
    })
  }

  // 添加选中内容到知识库
  const handleAddSelectionToKnowledge = async () => {
    const text = getIframeSelection()
    if (!text) {
      alert('请先在网页中选中要添加的内容')
      return
    }
    const title = text.substring(0, 50) + (text.length > 50 ? '...' : '')
    try {
      await knowledgeAPI.create({ title, content: text, category: '网页采集', tags: '网页采集' })
      alert('内容已添加到知识库')
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert('添加失败: ' + err.message)
    }
  }

  const handleOpenWebContentModal = () => {
    // 尝试从URL提取标题
    let title = webUrl
    try {
      const urlObj = new URL(webUrl)
      title = urlObj.hostname + ' - 采集内容'
    } catch (_) {}
    setWebContentTitle(title)
    setWebContentText('')
    setWebContentModalVisible(true)
  }

  const handleSaveWebContent = async () => {
    if (!webContentTitle.trim()) {
      alert('请输入标题')
      return
    }
    try {
      await knowledgeAPI.create({
        title: webContentTitle,
        content: webContentText,
        category: '网页采集',
        tags: '网页采集',
      })
      setWebContentModalVisible(false)
      closeWebModal()
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert(`保存失败: ${err.message}`)
    }
  }

  // ========== 从写作文稿新建知识 ==========
  const openWritingModal = async () => {
    setWritingModalVisible(true)
    setSelectedWriting(null)
    setWritingContent('')
    setWritingSelection('')
    setWritingFormTitle('')
    setWritingFormCategory('')
    setWritingFormTags('')
    try {
      const data = await writingAPI.getAll()
      setWritingList(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('获取写作文档失败:', err)
    }
  }

  const handleSelectWriting = async (doc) => {
    setSelectedWriting(doc)
    setWritingContent(doc.content || '')
    setWritingFormTitle(doc.title || '')
  }

  const handleSaveFromWriting = async () => {
    const content = writingSelection || writingContent
    if (!writingFormTitle.trim()) {
      alert('请输入标题')
      return
    }
    if (!content.trim()) {
      alert('请选择或输入内容')
      return
    }
    try {
      await knowledgeAPI.createFromWriting({
        title: writingFormTitle,
        content: content,
        category: writingFormCategory || null,
        tags: writingFormTags || null,
        doc_id: selectedWriting?.id,
      })
      setWritingModalVisible(false)
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert(`保存失败: ${err.message}`)
    }
  }

  // ========== 批量导入 ==========
  const handleBatchImport = () => {
    importFileRef.current?.click()
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await knowledgeAPI.importFromFile(file)
      alert('导入成功')
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert(`导入失败: ${err.message}`)
    }
    // 重置 input
    e.target.value = ''
  }

  // ========== 批量导出 ==========
  const handleExport = async (format) => {
    setExportDropdownVisible(false)
    try {
      await knowledgeAPI.exportAll(format)
    } catch (err) {
      alert(`导出失败: ${err.message}`)
    }
  }

  // ========== 排重 ==========
  const handleDeduplicate = async () => {
    if (!confirm('确定要删除内容重复的知识条目吗？每个重复内容只保留最早创建的一条。')) return
    try {
      const result = await knowledgeAPI.deduplicate()
      alert(`排重完成！删除了 ${result.removed_count} 条重复知识`)
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert('排重失败: ' + err.message)
    }
  }

  // ========== 批量管理 ==========
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === knowledgeList.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(knowledgeList.map(item => item.id))
    }
  }

  // 切换单个选择
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // 执行批量操作
  const handleBatchAction = async () => {
    if (selectedIds.length === 0) return
    try {
      if (batchAction === 'delete') {
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 条知识吗？`)) return
        await knowledgeAPI.batchDelete(selectedIds)
      } else if (batchAction === 'category') {
        if (!batchCategory.trim()) { alert('请输入新分类'); return }
        await knowledgeAPI.batchCategory(selectedIds, batchCategory.trim())
      } else if (batchAction === 'tags') {
        if (!batchTags.trim()) { alert('请输入标签'); return }
        await knowledgeAPI.batchTags(selectedIds, batchTags.trim(), batchTagMode)
      }
      setShowBatchModal(false)
      setSelectedIds([])
      setBatchMode(false)
      fetchKnowledge()
      fetchCategories()
    } catch (err) {
      alert('批量操作失败: ' + err.message)
    }
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
    <div className="knowledge-base">
      <div className="kb-toolbar">
        <div className="kb-search">
          <input
            type="text"
            className="kb-search-input"
            placeholder="搜索知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
          />
          <button className="kb-btn kb-btn-primary" onClick={handleSearch}>
            搜索
          </button>
        </div>
        <div className="kb-filters">
          <select
            className="kb-select"
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="">全部分类</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className="kb-count">共 {knowledgeList.length} 条知识</span>
        </div>
      </div>

      <div className="kb-toolbar-actions">
        <button
          className="kb-btn kb-btn-default"
          onClick={() => { setBatchMode(!batchMode); setSelectedIds([]); }}
          style={{marginRight: '8px'}}
        >
          {batchMode ? '退出批量' : '批量管理'}
        </button>
        {batchMode && selectedIds.length > 0 && (
          <span style={{marginRight: '8px', color: '#1890ff', fontSize: '13px'}}>
            已选 {selectedIds.length} 项
          </span>
        )}
        {batchMode && selectedIds.length > 0 && (
          <>
            <button className="kb-btn kb-btn-danger" onClick={() => { setBatchAction('delete'); setShowBatchModal(true); }} style={{marginRight: '4px'}}>
              批量删除
            </button>
            <button className="kb-btn kb-btn-default" onClick={() => { setBatchAction('category'); setShowBatchModal(true); }} style={{marginRight: '4px'}}>
              改分类
            </button>
            <button className="kb-btn kb-btn-default" onClick={() => { setBatchAction('tags'); setShowBatchModal(true); }}>
              改标签
            </button>
          </>
        )}
        <button className="kb-btn kb-btn-primary" onClick={openCreateModal}>
          + 新建知识
        </button>
        <button className="kb-btn kb-btn-default" onClick={openWebModal}>
          网页采集
        </button>
        <button className="kb-btn kb-btn-default" onClick={openWritingModal}>
          从文稿新建
        </button>
        <button className="kb-btn kb-btn-default" onClick={handleBatchImport}>
          批量导入
        </button>
        <div className="kb-export-wrapper" ref={exportDropdownRef}>
          <button
            className="kb-btn kb-btn-default"
            onClick={() => setExportDropdownVisible(!exportDropdownVisible)}
          >
            批量导出 ▼
          </button>
          {exportDropdownVisible && (
            <div className="kb-export-dropdown">
              <button onClick={() => handleExport('json')}>导出 JSON</button>
              <button onClick={() => handleExport('docx')}>导出 DOCX</button>
              <button onClick={() => handleExport('csv')}>导出 CSV</button>
            </div>
          )}
        </div>
        <button className="kb-btn kb-btn-default" onClick={handleDeduplicate} style={{marginLeft: '8px'}}>
          排重
        </button>
        {/* 隐藏的文件导入 input */}
        <input
          type="file"
          ref={importFileRef}
          style={{ display: 'none' }}
          accept=".json,.docx,.pdf,.txt,.csv"
          onChange={handleImportFileChange}
        />
      </div>

      {loading ? (
        <div className="kb-loading">加载中...</div>
      ) : knowledgeList.length === 0 ? (
        <div className="kb-empty">暂无知识条目</div>
      ) : (
        <div className="kb-grid">
          {batchMode && (
            <div style={{gridColumn: '1 / -1', marginBottom: '8px'}}>
              <input
                type="checkbox"
                checked={selectedIds.length === knowledgeList.length && knowledgeList.length > 0}
                onChange={toggleSelectAll}
                style={{marginRight: '8px', cursor: 'pointer'}}
              />
              <span style={{fontSize: '13px', color: '#666'}}>全选</span>
            </div>
          )}
          {knowledgeList.map((item) => (
            <div className="kb-card" key={item.id}>
              {batchMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  style={{marginRight: '8px', cursor: 'pointer'}}
                />
              )}
              <div className="kb-card-header">
                <h3 className="kb-card-title">{item.title}</h3>
                {item.category && (
                  <span className="kb-card-category">{item.category}</span>
                )}
              </div>
              <p className="kb-card-summary">
                {(item.content || '').substring(0, 100)}
                {(item.content || '').length > 100 ? '...' : ''}
              </p>
              {item.tags && item.tags.length > 0 && (
                <div className="kb-card-tags">
                  {(Array.isArray(item.tags) ? item.tags : []).map((tag, i) => (
                    <span className="kb-tag" key={i}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="kb-card-footer">
                <span className="kb-card-time">
                  {formatDate(item.created_at || item.createdAt)}
                </span>
                <div className="kb-card-actions">
                  <button
                    className="kb-btn kb-btn-link"
                    onClick={() => openEditModal(item)}
                  >
                    编辑
                  </button>
                  <button
                    className="kb-btn kb-btn-link kb-btn-danger"
                    onClick={() => handleDelete(item)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== 新建/编辑知识模态框 ========== */}
      {modalVisible && (
        <div className="kb-modal-overlay" onClick={closeModal}>
          <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>{editingItem ? '编辑知识' : '新建知识'}</h2>
              <button className="kb-modal-close" onClick={closeModal}>
                x
              </button>
            </div>
            <div className="kb-modal-body">
              <div className="kb-form-item">
                <label className="kb-form-label">标题</label>
                <input
                  type="text"
                  className="kb-form-input"
                  placeholder="请输入标题"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div className="kb-form-item">
                <label className="kb-form-label">内容</label>
                <textarea
                  className="kb-form-textarea"
                  placeholder="请输入内容"
                  rows={8}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                />
              </div>
              <div className="kb-form-item">
                <label className="kb-form-label">分类</label>
                <input
                  type="text"
                  className="kb-form-input"
                  placeholder="请输入分类"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div className="kb-form-item">
                <label className="kb-form-label">标签（逗号分隔）</label>
                <input
                  type="text"
                  className="kb-form-input"
                  placeholder="标签1, 标签2, 标签3"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
            </div>
            <div className="kb-modal-footer">
              <button className="kb-btn kb-btn-default" onClick={closeModal}>
                取消
              </button>
              <button className="kb-btn kb-btn-primary" onClick={handleSubmit}>
                {editingItem ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 网页采集模态框 ========== */}
      {webModalVisible && (
        <div className="kb-modal-overlay kb-modal-overlay-fullscreen" onClick={closeWebModal}>
          <div className={`kb-modal kb-modal-fullscreen ${webMaximized ? 'kb-modal-fullscreen-maximized' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>网页采集</h2>
              <button className="kb-modal-close" onClick={closeWebModal}>x</button>
            </div>
            <div className="kb-modal-body kb-web-modal-body">
              {/* URL 输入栏 */}
              <div className="kb-web-url-bar">
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    type="text"
                    className="kb-web-url-input"
                    placeholder="请输入网页地址..."
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate() }}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  <button
                    className="kb-btn kb-btn-default"
                    onClick={handleGoBack}
                    disabled={webHistory.length === 0}
                    title="返回上一个URL"
                  >
                    ← 返回
                  </button>
                  <button
                    className="kb-btn kb-btn-primary"
                    onClick={handleNavigate}
                  >
                    前往
                  </button>
                  <button
                    className="kb-btn kb-btn-default"
                    onClick={() => setWebMaximized(!webMaximized)}
                    title={webMaximized ? '还原' : '最大化'}
                  >
                    {webMaximized ? '❐ 还原' : '⬜ 最大化'}
                  </button>
                  <button
                    className="kb-btn kb-btn-sm kb-btn-default"
                    onClick={() => setWebPageSearchVisible(!webPageSearchVisible)}
                    title="页面内搜索"
                  >
                    🔍 页面搜索
                  </button>
                </div>
                <div className="kb-web-preset-sites">
                  {PRESET_SITES.map((site) => (
                    <button
                      key={site.name}
                      className="kb-btn kb-btn-sm kb-btn-preset"
                      onClick={() => handlePresetSiteClick(site.url)}
                    >
                      {site.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 页面内搜索 */}
              {webPageSearchVisible && (
                <div style={{display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid #e8e8e8', flexShrink: 0, alignItems: 'center', background: '#f0f5ff'}}>
                  <span style={{fontSize: '12px', color: '#1890ff'}}>🔍 页面内搜索</span>
                  <input
                    type="text"
                    placeholder="在当前页面中搜索..."
                    value={webPageSearchQuery}
                    onChange={(e) => setWebPageSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleWebPageSearch() }}
                    style={{flex: 1, height: '28px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', fontSize: '13px'}}
                  />
                  <button className="kb-btn kb-btn-sm kb-btn-primary" onClick={handleWebPageSearch}>查找</button>
                  <button className="kb-btn kb-btn-sm kb-btn-default" onClick={() => setWebPageSearchVisible(false)}>✕</button>
                </div>
              )}

              {/* 当前 URL 显示 */}
              {webUrl && (
                <div style={{fontSize: '11px', color: '#999', padding: '2px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  当前页面：{webUrl}
                </div>
              )}

              {/* iframe 加载区域 */}
              <div className="kb-web-iframe-container">
                {iframeLoading && (
                  <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10}}>
                    <div style={{fontSize: '16px', color: '#666'}}>正在加载网页...</div>
                  </div>
                )}
                {iframeLoadError && (
                  <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '20px'}}>
                    <div style={{fontSize: '48px', marginBottom: '16px'}}>⚠️</div>
                    <div style={{fontSize: '16px', color: '#333', marginBottom: '8px'}}>该网站不允许在框架中嵌入</div>
                    <div style={{fontSize: '14px', color: '#666', marginBottom: '16px'}}>请点击下方按钮在新窗口中打开</div>
                    <button className="kb-btn kb-btn-primary" onClick={() => window.open(webUrl, '_self')}>当前标签页打开</button>
                  </div>
                )}
                {webUrl ? (
                  <iframe
                    key={iframeKey}
                    src={webUrl}
                    className="kb-web-iframe"
                    title="网页采集"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"
                    onLoad={() => { setIframeLoading(false); }}
                    onError={() => { setIframeLoading(false); setIframeLoadError(true); }}
                  />
                ) : (
                  <div className="kb-web-iframe-placeholder">
                    请输入网址或选择预置网站
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="kb-web-actions">
                <button
                  className="kb-btn kb-btn-default"
                  onClick={handleOpenWebContentModal}
                >
                  选取内容新建知识
                </button>
                <button className="kb-btn kb-btn-default" onClick={() => window.open(webUrl, '_self')}>当前标签页打开</button>
                <button className="kb-btn kb-btn-default" onClick={closeWebModal}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 从网页内容新建知识子模态框 ========== */}
      {webContentModalVisible && (
        <div className="kb-modal-overlay" onClick={() => setWebContentModalVisible(false)}>
          <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>新建知识 - 网页采集</h2>
              <button className="kb-modal-close" onClick={() => setWebContentModalVisible(false)}>
                x
              </button>
            </div>
            <div className="kb-modal-body">
              <div className="kb-form-item">
                <label className="kb-form-label">标题</label>
                <input
                  type="text"
                  className="kb-form-input"
                  placeholder="请输入标题"
                  value={webContentTitle}
                  onChange={(e) => setWebContentTitle(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div className="kb-form-item">
                <label className="kb-form-label">内容</label>
                <textarea
                  className="kb-form-textarea"
                  placeholder="请粘贴或输入采集的内容..."
                  rows={10}
                  value={webContentText}
                  onChange={(e) => setWebContentText(e.target.value)}
                />
              </div>
            </div>
            <div className="kb-modal-footer">
              <button className="kb-btn kb-btn-default" onClick={() => setWebContentModalVisible(false)}>
                取消
              </button>
              <button className="kb-btn kb-btn-primary" onClick={handleSaveWebContent}>
                保存为知识
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 从写作文稿新建知识模态框 ========== */}
      {writingModalVisible && (
        <div className="kb-modal-overlay" onClick={() => setWritingModalVisible(false)}>
          <div className="kb-modal kb-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>从文稿新建知识</h2>
              <button className="kb-modal-close" onClick={() => setWritingModalVisible(false)}>
                x
              </button>
            </div>
            <div className="kb-modal-body">
              {/* 文档列表 */}
              <div className="kb-form-item">
                <label className="kb-form-label">选择写作文档</label>
                <div className="kb-writing-list">
                  {writingList.length === 0 ? (
                    <div className="kb-empty-small">暂无写作文档</div>
                  ) : (
                    writingList.map((doc) => (
                      <div
                        key={doc.id}
                        className={`kb-writing-item ${selectedWriting?.id === doc.id ? 'selected' : ''}`}
                        onClick={() => handleSelectWriting(doc)}
                      >
                        <span className="kb-writing-item-title">{doc.title}</span>
                        <span className="kb-writing-item-time">
                          {formatDate(doc.updated_at || doc.updatedAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 文档内容 */}
              {selectedWriting && (
                <>
                  <div className="kb-form-item">
                    <label className="kb-form-label">文档内容（可选择部分内容）</label>
                    <textarea
                      className="kb-form-textarea kb-writing-content-textarea"
                      rows={6}
                      value={writingContent}
                      onChange={(e) => {
                        setWritingContent(e.target.value)
                        setWritingSelection('')
                      }}
                    />
                  </div>
                  <div className="kb-form-item">
                    <label className="kb-form-label">选取的内容（留空则使用全部内容）</label>
                    <textarea
                      className="kb-form-textarea"
                      rows={4}
                      placeholder="在此粘贴或输入要选取的部分内容..."
                      value={writingSelection}
                      onChange={(e) => setWritingSelection(e.target.value)}
                    />
                  </div>
                  <div className="kb-form-item">
                    <label className="kb-form-label">标题</label>
                    <input
                      type="text"
                      className="kb-form-input"
                      placeholder="请输入标题"
                      value={writingFormTitle}
                      onChange={(e) => setWritingFormTitle(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  </div>
                  <div className="kb-form-item">
                    <label className="kb-form-label">分类</label>
                    <input
                      type="text"
                      className="kb-form-input"
                      placeholder="请输入分类"
                      value={writingFormCategory}
                      onChange={(e) => setWritingFormCategory(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  </div>
                  <div className="kb-form-item">
                    <label className="kb-form-label">标签（逗号分隔）</label>
                    <input
                      type="text"
                      className="kb-form-input"
                      placeholder="标签1, 标签2, 标签3"
                      value={writingFormTags}
                      onChange={(e) => setWritingFormTags(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="kb-modal-footer">
              <button className="kb-btn kb-btn-default" onClick={() => setWritingModalVisible(false)}>
                取消
              </button>
              <button
                className="kb-btn kb-btn-primary"
                onClick={handleSaveFromWriting}
                disabled={!selectedWriting}
              >
                保存为知识
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 批量操作模态框 ========== */}
      {showBatchModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: '#fff', borderRadius: '8px', padding: '24px', width: '420px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'}}>
            <h3 style={{margin: '0 0 16px 0', fontSize: '16px'}}>
              {batchAction === 'delete' ? '批量删除' : batchAction === 'category' ? '批量更改分类' : '批量更改标签'}
              <span style={{fontSize: '13px', color: '#999', fontWeight: 'normal', marginLeft: '8px'}}>(已选 {selectedIds.length} 项)</span>
            </h3>

            {batchAction === 'delete' && (
              <p style={{color: '#ff4d4f', marginBottom: '16px'}}>确定要删除选中的 {selectedIds.length} 条知识吗？此操作不可撤销。</p>
            )}

            {batchAction === 'category' && (
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', color: '#666'}}>新分类</label>
                <input
                  type="text"
                  value={batchCategory}
                  onChange={(e) => setBatchCategory(e.target.value)}
                  placeholder="输入新分类名称"
                  style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}}
                />
              </div>
            )}

            {batchAction === 'tags' && (
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', color: '#666'}}>标签（逗号分隔）</label>
                <input
                  type="text"
                  value={batchTags}
                  onChange={(e) => setBatchTags(e.target.value)}
                  placeholder="标签1,标签2,标签3"
                  style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box', marginBottom: '8px'}}
                />
                <div style={{display: 'flex', gap: '12px', fontSize: '13px'}}>
                  <label><input type="radio" name="tagMode" value="replace" checked={batchTagMode === 'replace'} onChange={(e) => setBatchTagMode(e.target.value)} /> 替换</label>
                  <label><input type="radio" name="tagMode" value="append" checked={batchTagMode === 'append'} onChange={(e) => setBatchTagMode(e.target.value)} /> 追加</label>
                  <label><input type="radio" name="tagMode" value="remove" checked={batchTagMode === 'remove'} onChange={(e) => setBatchTagMode(e.target.value)} /> 移除</label>
                </div>
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
              <button className="kb-btn kb-btn-default" onClick={() => setShowBatchModal(false)}>取消</button>
              <button className="kb-btn kb-btn-primary" onClick={handleBatchAction} style={batchAction === 'delete' ? {background: '#ff4d4f', borderColor: '#ff4d4f'} : {}}>
                {batchAction === 'delete' ? '确认删除' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase
