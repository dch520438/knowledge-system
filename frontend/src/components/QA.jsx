import { useState, useEffect, useRef } from 'react'
import { qaAPI, knowledgeAPI, searchAPI, llmAPI } from '../api'
import './QA.css'

function QA() {
  const [qaList, setQaList] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // 智能问答
  const [smartQuestion, setSmartQuestion] = useState('')
  const [smartAnswer, setSmartAnswer] = useState('')
  const [smartReferences, setSmartReferences] = useState([])
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState('')
  const [typingText, setTypingText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const typingTimerRef = useRef(null)

  // 大模型增强
  const [llmLoading, setLlmLoading] = useState(false)
  const [useLLM, setUseLLM] = useState(false)

  // 模态框
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formAnswer, setFormAnswer] = useState('')
  const [formReferences, setFormReferences] = useState([])

  // 模态框内搜索知识库
  const [kbSearchQuery, setKbSearchQuery] = useState('')
  const [kbSearchResults, setKbSearchResults] = useState([])
  const [kbSearching, setKbSearching] = useState(false)

  // 知识详情模态框
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailItem, setDetailItem] = useState(null)

  useEffect(() => {
    fetchQAList()
  }, [])

  // 清理打字效果定时器
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
    }
  }, [])

  const fetchQAList = async () => {
    setLoading(true)
    try {
      const data = await qaAPI.getAll()
      setQaList(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('获取问答列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // ========== 智能问答 ==========
  const handleSmartAsk = async () => {
    if (!smartQuestion.trim()) {
      setSmartError('请输入问题')
      return
    }

    setSmartError('')
    setSmartAnswer('')
    setSmartReferences([])
    setSmartLoading(true)
    setIsTyping(false)
    setTypingText('')

    if (useLLM) {
      // 使用大模型增强
      setLlmLoading(true)
      try {
        const result = await llmAPI.qa(smartQuestion.trim())
        const answer = result.answer || result.content || '暂无回答'
        const refs = result.sources || result.references || []

        setSmartReferences(refs)

        // 打字效果
        setIsTyping(true)
        let currentIndex = 0
        const fullText = answer

        const typeNext = () => {
          if (currentIndex < fullText.length) {
            const chunkSize = Math.min(3, fullText.length - currentIndex)
            currentIndex += chunkSize
            setTypingText(fullText.substring(0, currentIndex))
            typingTimerRef.current = setTimeout(typeNext, 30)
          } else {
            setIsTyping(false)
            setSmartAnswer(fullText)
            setTypingText('')
          }
        }

        typeNext()

        // 自动保存问答记录
        try {
          await qaAPI.create({
            question: smartQuestion,
            answer: answer,
            references: refs,
          })
          fetchQAList()
        } catch (saveErr) {
          console.error('自动保存问答记录失败:', saveErr)
        }
      } catch (err) {
        setSmartError(`AI回答失败: ${err.message}`)
      } finally {
        setLlmLoading(false)
        setSmartLoading(false)
      }
    } else {
      // 使用原有的关键词匹配
      try {
        const result = await qaAPI.smartAnswer(smartQuestion)

        // 提取回答和引用
        const answer = result.answer || result.response || '暂无回答'
        const refs = result.references || result.sources || []

        setSmartReferences(refs)

        // 打字效果
        setIsTyping(true)
        let currentIndex = 0
        const fullText = answer

        const typeNext = () => {
          if (currentIndex < fullText.length) {
            // 每次添加1-3个字符，模拟打字速度
            const chunkSize = Math.min(3, fullText.length - currentIndex)
            currentIndex += chunkSize
            setTypingText(fullText.substring(0, currentIndex))
            typingTimerRef.current = setTimeout(typeNext, 30)
          } else {
            setIsTyping(false)
            setSmartAnswer(fullText)
            setTypingText('')
          }
        }

        typeNext()

        // 自动保存问答记录
        try {
          await qaAPI.create({
            question: smartQuestion,
            answer: answer,
            references: refs,
          })
          fetchQAList()
        } catch (saveErr) {
          console.error('自动保存问答记录失败:', saveErr)
        }
      } catch (err) {
        setSmartError(`提问失败: ${err.message}`)
      } finally {
        setSmartLoading(false)
      }
    }
  }

  const handleSmartKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSmartAsk()
    }
  }

  // 查看知识详情
  const openKnowledgeDetail = (item) => {
    setDetailItem(item)
    setDetailModalVisible(true)
  }

  // ========== 手动新建/编辑问答 ==========
  const openCreateModal = () => {
    setEditingItem(null)
    setFormQuestion('')
    setFormAnswer('')
    setFormReferences([])
    setKbSearchQuery('')
    setKbSearchResults([])
    setModalVisible(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormQuestion(item.question || '')
    setFormAnswer(item.answer || '')
    setFormReferences(Array.isArray(item.references) ? item.references : [])
    setKbSearchQuery('')
    setKbSearchResults([])
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setEditingItem(null)
  }

  const handleSubmit = async () => {
    if (!formQuestion.trim()) {
      alert('请输入问题')
      return
    }

    const data = {
      question: formQuestion,
      answer: formAnswer,
      references: formReferences,
    }

    try {
      if (editingItem) {
        await qaAPI.update(editingItem.id, data)
      } else {
        await qaAPI.create(data)
      }
      closeModal()
      fetchQAList()
    } catch (err) {
      alert(`操作失败: ${err.message}`)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`确定要删除该问答吗？`)) return
    try {
      await qaAPI.delete(item.id)
      fetchQAList()
    } catch (err) {
      alert(`删除失败: ${err.message}`)
    }
  }

  // 模态框内搜索知识库
  const handleKbSearch = async () => {
    if (!kbSearchQuery.trim()) return
    setKbSearching(true)
    try {
      const data = await knowledgeAPI.getAll({ search: kbSearchQuery })
      setKbSearchResults(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      console.error('搜索知识库失败:', err)
    } finally {
      setKbSearching(false)
    }
  }

  const addReference = (item) => {
    const exists = formReferences.find((r) => r.id === item.id)
    if (exists) return
    setFormReferences([...formReferences, item])
  }

  const removeReference = (id) => {
    setFormReferences(formReferences.filter((r) => r.id !== id))
  }

  const isReferenced = (id) => {
    return formReferences.some((r) => r.id === id)
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
    <div className="qa">
      {/* ========== 智能问答区域 ========== */}
      <div className="qa-smart-section">
        <div className="qa-smart-header">
          <h2 className="qa-smart-title">智能问答</h2>
          <button className="qa-btn qa-btn-default" onClick={openCreateModal}>
            + 手动新建问答
          </button>
        </div>
        <div className="qa-smart-input-area">
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#666', cursor: 'pointer', marginBottom: '8px'}}>
            <input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} />
            🤖 使用大模型增强
          </label>
          <textarea
            className="qa-smart-input"
            placeholder="请输入您的问题...（按 Enter 提问，Shift+Enter 换行）"
            value={smartQuestion}
            onChange={(e) => setSmartQuestion(e.target.value)}
            onKeyDown={handleSmartKeyDown}
            rows={3}
            autoComplete="off"
            autoCorrect="off"
          />
          <button
            className="qa-btn qa-btn-primary qa-smart-submit"
            onClick={handleSmartAsk}
            disabled={smartLoading || isTyping}
          >
            {smartLoading ? '思考中...' : isTyping ? '回答中...' : '提问'}
          </button>
        </div>

        {/* 错误提示 */}
        {smartError && (
          <div className="qa-smart-error">{smartError}</div>
        )}

        {/* 回答区域 */}
        {(smartAnswer || typingText || isTyping) && (
          <div className="qa-smart-answer-area">
            <div className="qa-smart-question-display">
              <span className="qa-card-icon">Q</span>
              <span className="qa-smart-question-text">{smartQuestion}</span>
            </div>
            <div className="qa-smart-answer-display">
              <span className="qa-card-icon answer-icon">A</span>
              <div className="qa-smart-answer-text">
                {isTyping ? typingText : smartAnswer}
                {isTyping && <span className="qa-typing-cursor">|</span>}
              </div>
            </div>
            {/* 引用来源 */}
            {smartReferences.length > 0 && (
              <div className="qa-smart-references">
                <span className="qa-smart-refs-label">引用来源：</span>
                <div className="qa-smart-refs-list">
                  {smartReferences.map((ref, i) => (
                    <button
                      key={ref.id || i}
                      className="qa-smart-ref-tag"
                      onClick={() => openKnowledgeDetail(ref)}
                    >
                      {ref.title || `来源 ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== 问答历史 ========== */}
      <div className="qa-history-section">
        <h3 className="qa-history-title">问答历史</h3>
        {loading ? (
          <div className="qa-loading">加载中...</div>
        ) : qaList.length === 0 ? (
          <div className="qa-empty">暂无问答记录</div>
        ) : (
          <div className="qa-list">
            {qaList.map((item) => {
              const isExpanded = expandedId === item.id
              const refs = Array.isArray(item.references) ? item.references : []
              return (
                <div className="qa-card" key={item.id}>
                  <div className="qa-card-main" onClick={() => toggleExpand(item.id)}>
                    <div className="qa-card-question">
                      <span className="qa-card-icon">Q</span>
                      <span className="qa-card-question-text">{item.question}</span>
                    </div>
                    <div className="qa-card-meta">
                      {refs.length > 0 && (
                        <span className="qa-card-ref-count">
                          引用 {refs.length} 条知识
                        </span>
                      )}
                      <span className="qa-card-time">
                        {formatDate(item.created_at || item.createdAt)}
                      </span>
                      <span className={`qa-card-arrow ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  <div className={`qa-card-detail ${isExpanded ? 'show' : ''}`}>
                    <div className="qa-card-answer">
                      <span className="qa-card-icon answer-icon">A</span>
                      <div className="qa-card-answer-text">
                        {item.answer || '暂无回答'}
                      </div>
                    </div>
                    {refs.length > 0 && (
                      <div className="qa-card-refs">
                        <span className="qa-refs-label">引用知识：</span>
                        <div className="qa-refs-list">
                          {refs.map((ref, i) => (
                            <button
                              className="qa-ref-tag qa-ref-tag-clickable"
                              key={ref.id || i}
                              onClick={(e) => {
                                e.stopPropagation()
                                openKnowledgeDetail(ref)
                              }}
                            >
                              {ref.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="qa-card-actions">
                      <button
                        className="qa-btn qa-btn-link"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(item)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="qa-btn qa-btn-link qa-btn-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item)
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========== 手动新建/编辑问答模态框 ========== */}
      {modalVisible && (
        <div className="qa-modal-overlay" onClick={closeModal}>
          <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qa-modal-header">
              <h2>{editingItem ? '编辑问答' : '新建问答'}</h2>
              <button className="qa-modal-close" onClick={closeModal}>
                x
              </button>
            </div>
            <div className="qa-modal-body">
              <div className="qa-form-item">
                <label className="qa-form-label">问题</label>
                <input
                  type="text"
                  className="qa-form-input"
                  placeholder="请输入问题"
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div className="qa-form-item">
                <label className="qa-form-label">回答</label>
                <textarea
                  className="qa-form-textarea"
                  placeholder="请输入回答"
                  rows={6}
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                />
              </div>

              {/* 搜索知识库辅助回答 */}
              <div className="qa-form-item">
                <label className="qa-form-label">搜索知识库辅助回答</label>
                <div className="qa-kb-search">
                  <input
                    type="text"
                    className="qa-form-input"
                    placeholder="输入关键词搜索知识库..."
                    value={kbSearchQuery}
                    onChange={(e) => setKbSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleKbSearch()}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  <button
                    className="qa-btn qa-btn-primary"
                    onClick={handleKbSearch}
                  >
                    {kbSearching ? '搜索中...' : '搜索'}
                  </button>
                </div>
                {kbSearchResults.length > 0 && (
                  <div className="qa-kb-results">
                    {kbSearchResults.map((item) => (
                      <div
                        className={`qa-kb-result-item ${isReferenced(item.id) ? 'referenced' : ''}`}
                        key={item.id}
                        onClick={() => addReference(item)}
                      >
                        <div className="qa-kb-result-title">
                          {item.title}
                          {isReferenced(item.id) && (
                            <span className="qa-kb-result-badge">已引用</span>
                          )}
                        </div>
                        <div className="qa-kb-result-summary">
                          {(item.content || '').substring(0, 80)}
                          {(item.content || '').length > 80 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 已引用的知识 */}
              {formReferences.length > 0 && (
                <div className="qa-form-item">
                  <label className="qa-form-label">
                    已引用知识 ({formReferences.length})
                  </label>
                  <div className="qa-ref-tags">
                    {formReferences.map((ref) => (
                      <span className="qa-ref-tag-edit" key={ref.id}>
                        {ref.title}
                        <button
                          className="qa-ref-tag-remove"
                          onClick={() => removeReference(ref.id)}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="qa-modal-footer">
              <button className="qa-btn qa-btn-default" onClick={closeModal}>
                取消
              </button>
              <button className="qa-btn qa-btn-primary" onClick={handleSubmit}>
                {editingItem ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 知识详情模态框 ========== */}
      {detailModalVisible && detailItem && (
        <div className="qa-modal-overlay" onClick={() => setDetailModalVisible(false)}>
          <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qa-modal-header">
              <h2>知识详情</h2>
              <button className="qa-modal-close" onClick={() => setDetailModalVisible(false)}>
                x
              </button>
            </div>
            <div className="qa-modal-body">
              <div className="qa-form-item">
                <label className="qa-form-label">标题</label>
                <div className="qa-detail-title">{detailItem.title}</div>
              </div>
              {detailItem.category && (
                <div className="qa-form-item">
                  <label className="qa-form-label">分类</label>
                  <div className="qa-detail-category">{detailItem.category}</div>
                </div>
              )}
              <div className="qa-form-item">
                <label className="qa-form-label">内容</label>
                <div className="qa-detail-content">
                  {detailItem.content || '暂无内容'}
                </div>
              </div>
              {detailItem.tags && detailItem.tags.length > 0 && (
                <div className="qa-form-item">
                  <label className="qa-form-label">标签</label>
                  <div className="qa-detail-tags">
                    {(Array.isArray(detailItem.tags) ? detailItem.tags : []).map((tag, i) => (
                      <span className="qa-ref-tag" key={i}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="qa-modal-footer">
              <button className="qa-btn qa-btn-default" onClick={() => setDetailModalVisible(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QA
