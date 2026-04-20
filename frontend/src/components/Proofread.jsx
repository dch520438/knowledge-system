import { useState, useEffect, useRef } from 'react'
import { proofreadAPI } from '../api'
import './Proofread.css'

function Proofread({ content, onJumpToPosition, onCheck, onClearHighlights }) {
  const [rules, setRules] = useState([])
  const [errors, setErrors] = useState([])
  const [checking, setChecking] = useState(false)
  const [showRuleManager, setShowRuleManager] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [formName, setFormName] = useState('')
  const [formPattern, setFormPattern] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSeverity, setFormSeverity] = useState('warning')

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const data = await proofreadAPI.getRules()
      setRules(data)
    } catch (err) {
      console.error('获取规则失败', err)
    }
  }

  const handleCheck = async () => {
    if (!content || !content.trim()) {
      alert('请先输入文稿内容')
      return
    }
    setChecking(true)
    try {
      // 将 HTML 内容转为纯文本用于检查
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = content
      const plainText = tempDiv.textContent || tempDiv.innerText || ''

      if (!plainText.trim()) {
        alert('文稿内容为空')
        setChecking(false)
        return
      }

      const result = await proofreadAPI.check(plainText)
      setErrors(result.errors || [])
      if (onCheck) {
        onCheck(result.errors || [])
      }
    } catch (err) {
      alert('核稿检查失败: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  const handleCreateRule = async () => {
    if (!formName.trim() || !formPattern.trim()) {
      alert('请填写规则名称和匹配模式')
      return
    }
    try {
      // 验证正则表达式
      new RegExp(formPattern)
      await proofreadAPI.createRule({
        name: formName,
        pattern: formPattern,
        description: formDescription,
        severity: formSeverity,
      })
      setFormName('')
      setFormPattern('')
      setFormDescription('')
      setFormSeverity('warning')
      fetchRules()
    } catch (err) {
      if (err.message.includes('Invalid regular expression') || err.message.includes('正则')) {
        alert('正则表达式格式错误，请检查')
      } else {
        alert('创建规则失败: ' + err.message)
      }
    }
  }

  const handleUpdateRule = async () => {
    if (!formName.trim() || !formPattern.trim()) return
    try {
      new RegExp(formPattern)
      await proofreadAPI.updateRule(editingRule.id, {
        name: formName,
        pattern: formPattern,
        description: formDescription,
        severity: formSeverity,
      })
      setEditingRule(null)
      setFormName('')
      setFormPattern('')
      setFormDescription('')
      setFormSeverity('warning')
      fetchRules()
    } catch (err) {
      alert('更新规则失败: ' + err.message)
    }
  }

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('确定要删除此规则吗？')) return
    try {
      await proofreadAPI.deleteRule(ruleId)
      fetchRules()
    } catch (err) {
      alert(err.message)
    }
  }

  const startEdit = (rule) => {
    setEditingRule(rule)
    setFormName(rule.name)
    setFormPattern(rule.pattern)
    setFormDescription(rule.description || '')
    setFormSeverity(rule.severity)
  }

  const cancelEdit = () => {
    setEditingRule(null)
    setFormName('')
    setFormPattern('')
    setFormDescription('')
    setFormSeverity('warning')
  }

  const severityLabel = { error: '错误', warning: '警告', info: '提示' }
  const severityColor = { error: '#ff4d4f', warning: '#faad14', info: '#1890ff' }

  return (
    <div className="proofread-panel">
      <div className="proofread-header">
        <div className="proofread-header-left">
          <h3>核稿检查</h3>
          <span className="proofread-count">
            {errors.length > 0 ? `发现 ${errors.length} 个问题` : '未发现问题'}
          </span>
        </div>
        <div className="proofread-header-right">
          <button className="pr-btn pr-btn-primary" onClick={handleCheck} disabled={checking}>
            {checking ? '检查中...' : '开始核稿'}
          </button>
          <button className="pr-btn pr-btn-default" onClick={() => setShowRuleManager(!showRuleManager)}>
            {showRuleManager ? '隐藏规则' : '管理规则'}
          </button>
          {onClearHighlights && errors.length > 0 && (
            <button className="pr-btn pr-btn-default" onClick={onClearHighlights} style={{marginLeft: '4px'}}>
              清除高亮
            </button>
          )}
        </div>
      </div>

      {/* 错误列表 */}
      <div className="proofread-results">
        {errors.length === 0 ? (
          <div className="proofread-empty">
            {checking ? '正在检查...' : '点击"开始核稿"检查文稿中的问题'}
          </div>
        ) : (
          errors.map((err, idx) => (
            <div
              key={idx}
              className="proofread-error-item"
              onClick={() => onJumpToPosition && onJumpToPosition(err.start, err.end)}
              style={{borderLeftColor: severityColor[err.severity]}}
            >
              <div className="proofread-error-header">
                <span className="proofread-error-badge" style={{background: severityColor[err.severity]}}>
                  {severityLabel[err.severity] || err.severity}
                </span>
                <span className="proofread-error-name">{err.rule_name}</span>
                <span className="proofread-error-line">第 {err.line} 行</span>
              </div>
              <div className="proofread-error-desc">{err.description}</div>
              <div className="proofread-error-match">
                匹配内容：<code>{err.matched_text}</code>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 规则管理 */}
      {showRuleManager && (
        <div className="proofread-rules">
          <h4>核稿规则管理</h4>

          {/* 新建/编辑规则表单 */}
          <div className="pr-rule-form">
            <input
              type="text"
              placeholder="规则名称"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="pr-input"
            />
            <input
              type="text"
              placeholder="正则表达式"
              value={formPattern}
              onChange={(e) => setFormPattern(e.target.value)}
              className="pr-input"
            />
            <input
              type="text"
              placeholder="规则描述（可选）"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="pr-input"
            />
            <select value={formSeverity} onChange={(e) => setFormSeverity(e.target.value)} className="pr-select">
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">提示</option>
            </select>
            <div className="pr-rule-form-actions">
              {editingRule ? (
                <>
                  <button className="pr-btn pr-btn-primary" onClick={handleUpdateRule}>保存修改</button>
                  <button className="pr-btn pr-btn-default" onClick={cancelEdit}>取消</button>
                </>
              ) : (
                <button className="pr-btn pr-btn-primary" onClick={handleCreateRule}>添加规则</button>
              )}
            </div>
          </div>

          {/* 规则列表 */}
          <div className="pr-rule-list">
            {rules.map((rule) => (
              <div key={rule.id} className="pr-rule-item">
                <div className="pr-rule-info">
                  <span className="pr-rule-name">{rule.is_builtin ? '📌 ' : ''}{rule.name}</span>
                  <span className="pr-rule-pattern">{rule.pattern}</span>
                  <span className="pr-rule-severity" style={{color: severityColor[rule.severity]}}>
                    {severityLabel[rule.severity]}
                  </span>
                </div>
                <div className="pr-rule-actions">
                  <button className="pr-btn pr-btn-sm" onClick={() => startEdit(rule)}>编辑</button>
                  {!rule.is_builtin && (
                    <button className="pr-btn pr-btn-sm pr-btn-danger" onClick={() => handleDeleteRule(rule.id)}>删除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Proofread
