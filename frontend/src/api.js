const BASE_URL = ''

async function request(url, options = {}) {
  const config = { ...options }

  // 只对非 FormData 的 body 设置 Content-Type
  if (config.body && !(config.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
  }

  const response = await fetch(`${BASE_URL}${url}`, config)

  if (!response.ok) {
    let errorMsg = `请求失败: ${response.status}`
    try {
      const error = await response.json()
      if (typeof error.detail === 'string') {
        errorMsg = error.detail
      } else if (Array.isArray(error.detail)) {
        errorMsg = error.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
      }
    } catch (_) {}
    throw new Error(errorMsg)
  }

  return response.json()
}

// 文件下载辅助函数
async function downloadFile(url, defaultFilename = 'export.docx') {
  const response = await fetch(`${BASE_URL}${url}`)
  if (!response.ok) {
    let errorMsg = `下载失败: ${response.status}`
    try {
      const error = await response.json()
      if (typeof error.detail === 'string') errorMsg = error.detail
    } catch (_) {}
    throw new Error(errorMsg)
  }
  const blob = await response.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const disposition = response.headers.get('Content-Disposition')
  if (disposition) {
    const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
    if (filenameMatch) {
      link.download = decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
    } else {
      link.download = defaultFilename
    }
  } else {
    link.download = defaultFilename
  }
  link.click()
  URL.revokeObjectURL(link.href)
}

// 知识库 API
export const knowledgeAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/knowledge${query ? '?' + query : ''}`)
  },

  // 通过POST搜索，避免中文URL编码问题
  search: (params = {}) =>
    request('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getById: (id) => request(`/api/knowledge/${id}`),

  create: (data) =>
    request('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    request(`/api/knowledge/${id}`, {
      method: 'DELETE',
    }),

  getCategories: () => request('/api/knowledge/categories'),

  // 批量创建
  batchCreate: (data) =>
    request('/api/knowledge/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 从文件导入
  importFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/api/knowledge/import', {
      method: 'POST',
      body: formData,
    })
  },

  // 批量导出
  exportAll: (format = 'json') => {
    const ext = format === 'docx' ? 'docx' : format === 'csv' ? 'csv' : 'json'
    return downloadFile(`/api/knowledge/export?format=${format}`, `knowledge_export.${ext}`)
  },

  // 从写作文稿新建知识
  createFromWriting: (data) =>
    request('/api/knowledge/from-writing', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchDelete: (ids) => request('/api/knowledge/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  batchCategory: (ids, category) => request('/api/knowledge/batch-category', { method: 'PUT', body: JSON.stringify({ ids, category }) }),
  batchTags: (ids, tags, mode = 'replace') => request('/api/knowledge/batch-tags', { method: 'PUT', body: JSON.stringify({ ids, tags, mode }) }),

  // 排重
  deduplicate: () => request('/api/knowledge/deduplicate', { method: 'POST' }),
}

// 写作 API
export const writingAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/api/writing${query ? '?' + query : ''}`)
  },

  getById: (id) => request(`/api/writing/${id}`),

  create: (data) =>
    request('/api/writing', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/writing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    request(`/api/writing/${id}`, {
      method: 'DELETE',
    }),

  // 导出文档
  exportDoc: (docId, format = 'docx') => {
    const ext = format === 'docx' ? 'docx' : 'txt'
    return downloadFile(`/api/writing/${docId}/export?format=${format}`, `document.${ext}`)
  },

  // 从文件导入文档
  importFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/api/writing/import', {
      method: 'POST',
      body: formData,
    })
  },
}

// 问答 API
export const qaAPI = {
  getAll: () => request('/api/qa'),

  getById: (id) => request(`/api/qa/${id}`),

  create: (data) =>
    request('/api/qa', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/api/qa/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    request(`/api/qa/${id}`, {
      method: 'DELETE',
    }),

  // 智能问答
  smartAnswer: (question) =>
    request('/api/qa/smart-answer', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
}

// 搜索 API
export const searchAPI = {
  search: (query) => request(`/api/search?q=${encodeURIComponent(query)}`),
}

// 核稿规则 API
export const proofreadAPI = {
  getRules: () => request('/api/proofread/rules'),
  createRule: (data) => request('/api/proofread/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id, data) => request(`/api/proofread/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRule: (id) => request(`/api/proofread/rules/${id}`, { method: 'DELETE' }),
  check: (content) => request('/api/proofread/check', { method: 'POST', body: JSON.stringify({ content }) }),
}
