import { useState, useEffect } from 'react'
import { llmAPI } from '../api'

function Settings() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
  const [form, setForm] = useState({
    name: '', provider: 'openai', api_base: '', api_key: '', model: '',
    max_tokens: 2048, temperature: 0.7,
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  useEffect(() => { fetchConfigs() }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const data = await llmAPI.getConfigs()
      setConfigs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('获取配置失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingConfig(null)
    setForm({ name: '', provider: 'openai', api_base: 'https://api.openai.com/v1', api_key: '', model: 'gpt-3.5-turbo', max_tokens: 2048, temperature: 0.7 })
    setShowAddModal(true)
  }

  const openEdit = (config) => {
    setEditingConfig(config)
    setForm({
      name: config.name, provider: config.provider, api_base: config.api_base,
      api_key: config.api_key || '', model: config.model,
      max_tokens: config.max_tokens || 2048, temperature: config.temperature || 0.7,
    })
    setShowAddModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.api_base.trim() || !form.model.trim()) {
      alert('请填写名称、API地址和模型名称')
      return
    }
    try {
      if (editingConfig) {
        await llmAPI.update(editingConfig.id, form)
      } else {
        await llmAPI.create(form)
      }
      setShowAddModal(false)
      fetchConfigs()
    } catch (err) {
      alert('保存失败: ' + err.message)
    }
  }

  const handleDelete = async (config) => {
    if (!confirm(`确定删除配置「${config.name}」吗？`)) return
    try {
      await llmAPI.delete(config.id)
      fetchConfigs()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  const handleActivate = async (config) => {
    try {
      await llmAPI.activate(config.id)
      fetchConfigs()
    } catch (err) {
      alert('激活失败: ' + err.message)
    }
  }

  const handleTest = async () => {
    if (!form.api_base.trim() || !form.model.trim()) {
      alert('请填写API地址和模型名称')
      return
    }
    setTesting(true)
    setTestResult('')
    try {
      const result = await llmAPI.chat([{ role: 'user', content: '你好，请回复"连接成功"' }])
      setTestResult('✅ 测试成功: ' + result.content.substring(0, 100))
    } catch (err) {
      setTestResult('❌ 测试失败: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  const getProviderLabel = (p) => {
    const map = { openai: 'OpenAI', deepseek: 'DeepSeek', qwen: '通义千问', ollama: 'Ollama(本地)', custom: '自定义' }
    return map[p] || p
  }

  // 预设配置
  const presets = {
    openai: { api_base: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
    deepseek: { api_base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    qwen: { api_base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
    ollama: { api_base: 'http://localhost:11434/v1', model: 'qwen2:7b' },
    custom: { api_base: '', model: '' },
  }

  return (
    <div style={{padding: '24px', maxWidth: '900px', margin: '0 auto'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2 style={{margin: 0, fontSize: '20px'}}>⚙️ 大模型设置</h2>
        <button className="kb-btn kb-btn-primary" onClick={openAdd}>+ 添加配置</button>
      </div>

      <div style={{background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: '8px', padding: '16px', marginBottom: '24px', fontSize: '13px', color: '#003a8c'}}>
        <strong>使用说明：</strong>添加大模型配置后，智能问答、写作助手、知识库处理、智能核稿等功能将自动使用大模型增强。支持 OpenAI 兼容接口（DeepSeek、通义千问等）和本地模型（Ollama、LM Studio）。
      </div>

      {loading ? (
        <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>加载中...</div>
      ) : configs.length === 0 ? (
        <div style={{textAlign: 'center', padding: '60px 20px', color: '#999'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>🤖</div>
          <div style={{fontSize: '16px', marginBottom: '8px'}}>暂无大模型配置</div>
          <div style={{fontSize: '13px'}}>点击"添加配置"开始设置</div>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {configs.map(config => (
            <div key={config.id} style={{
              border: '1px solid', borderColor: config.is_active ? '#52c41a' : '#e8e8e8',
              borderRadius: '8px', padding: '16px', background: config.is_active ? '#f6ffed' : '#fff',
            }}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                    <strong style={{fontSize: '15px'}}>{config.name}</strong>
                    <span style={{fontSize: '11px', background: '#e6f7ff', color: '#1890ff', padding: '1px 6px', borderRadius: '3px'}}>
                      {getProviderLabel(config.provider)}
                    </span>
                    {config.is_active && (
                      <span style={{fontSize: '11px', background: '#f6ffed', color: '#52c41a', padding: '1px 6px', borderRadius: '3px'}}>
                        ✓ 使用中
                      </span>
                    )}
                  </div>
                  <div style={{fontSize: '12px', color: '#999'}}>
                    模型: {config.model} | 地址: {config.api_base}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  {!config.is_active && (
                    <button className="kb-btn kb-btn-default" onClick={() => handleActivate(config)} style={{fontSize: '12px'}}>激活</button>
                  )}
                  <button className="kb-btn kb-btn-default" onClick={() => openEdit(config)} style={{fontSize: '12px'}}>编辑</button>
                  <button className="kb-btn kb-btn-link kb-btn-danger" onClick={() => handleDelete(config)} style={{fontSize: '12px'}}>删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑模态框 */}
      {showAddModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: '#fff', borderRadius: '8px', padding: '24px', width: '520px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.15)'}} onClick={(e) => e.stopPropagation()}>
            <h3 style={{margin: '0 0 20px 0', fontSize: '16px'}}>{editingConfig ? '编辑配置' : '添加配置'}</h3>

            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>配置名称</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="如：DeepSeek" style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>提供商</label>
                <select value={form.provider} onChange={(e) => {
                  const p = e.target.value
                  const preset = presets[p] || {}
                  setForm({...form, provider: p, api_base: preset.api_base || form.api_base, model: preset.model || form.model})
                }} style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px'}}>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问</option>
                  <option value="ollama">Ollama（本地）</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>API 地址</label>
                <input type="text" value={form.api_base} onChange={(e) => setForm({...form, api_base: e.target.value})} placeholder="https://api.openai.com/v1" style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>API 密钥</label>
                <input type="password" value={form.api_key} onChange={(e) => setForm({...form, api_key: e.target.value})} placeholder="sk-...（本地模型可留空）" style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
              </div>

              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>模型名称</label>
                <input type="text" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} placeholder="gpt-3.5-turbo" style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
              </div>

              <div style={{display: 'flex', gap: '12px'}}>
                <div style={{flex: 1}}>
                  <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>最大Token数</label>
                  <input type="number" value={form.max_tokens} onChange={(e) => setForm({...form, max_tokens: parseInt(e.target.value) || 2048})} style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
                </div>
                <div style={{flex: 1}}>
                  <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', color: '#666'}}>温度 (0-1)</label>
                  <input type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={(e) => setForm({...form, temperature: parseFloat(e.target.value) || 0.7})} style={{width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '0 8px', boxSizing: 'border-box'}} />
                </div>
              </div>

              <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer'}}>
                <input type="checkbox" checked={form.is_active || !editingConfig} onChange={(e) => setForm({...form, is_active: e.target.checked})} />
                保存后立即激活
              </label>
            </div>

            {testResult && (
              <div style={{marginTop: '12px', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', background: testResult.startsWith('✅') ? '#f6ffed' : '#fff2f0', color: testResult.startsWith('✅') ? '#52c41a' : '#ff4d4f', border: `1px solid ${testResult.startsWith('✅') ? '#b7eb8f' : '#ffccc7'}`}}>
                {testResult}
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '8px'}}>
              <button className="kb-btn kb-btn-default" onClick={handleTest} disabled={testing}>
                {testing ? '测试中...' : '🔌 测试连接'}
              </button>
              <div style={{display: 'flex', gap: '8px'}}>
                <button className="kb-btn kb-btn-default" onClick={() => setShowAddModal(false)}>取消</button>
                <button className="kb-btn kb-btn-primary" onClick={handleSubmit}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
