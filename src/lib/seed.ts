import type { Snapshot } from '../types'
export const DEMO_TEAM = 'demo-team'
export const DEMO_USER = 'demo-user'
export function seed(): Snapshot {
  const now = new Date().toISOString()
  const common = { team_id: DEMO_TEAM, created_by: DEMO_USER, created_at: now, updated_at: now }
  return {
    members: [{ team_id: DEMO_TEAM, user_id: DEMO_USER, display_name: '研究成员（演示）' }],
    literature: [
      { ...common, id: 'embeddedness', title: 'Economic Action and Social Structure: The Problem of Embeddedness', authors: 'Mark Granovetter', journal: 'American Journal of Sociology · 91(3): 481–510', year: 1985, keywords: ['社会关系', '经济行动', '嵌入性'], tags: ['嵌入性治理'], theory_tags: ['嵌入性治理'], source_url: 'https://doi.org/10.1086/228311', file_path: null, file_name: null, file_size: null },
      { ...common, id: 'collaborative', title: 'Collaborative Governance in Theory and Practice', authors: 'Chris Ansell; Alison Gash', journal: 'Journal of Public Administration Research and Theory · 18(4): 543–571', year: 2008, keywords: ['多主体合作', '制度设计', '协同过程'], tags: ['协同治理', '乡村治理'], theory_tags: ['协同治理'], source_url: 'https://doi.org/10.1093/jopart/mum032', file_path: null, file_name: null, file_size: null },
    ],
    tasks: [
      { ...common, id: 'task-1', title: '案例材料收集', description: '整理产业发展材料，列出需要访谈核实的事实与时间节点。', status: 'todo', assignee_id: null, due_date: null },
      { ...common, id: 'task-2', title: '案例正文撰写', description: '围绕“养出来”到“卖出去”的市场连接过程建立叙事。', status: 'todo', assignee_id: null, due_date: null },
      { ...common, id: 'task-3', title: '理论文献搜集', description: '收集嵌入性、社会角色与协同治理相关研究。', status: 'doing', assignee_id: DEMO_USER, due_date: null },
      { ...common, id: 'task-4', title: '分析框架完善', description: '建立研究问题、理论命题与案例证据之间的对应关系。', status: 'doing', assignee_id: null, due_date: null },
      { ...common, id: 'task-5', title: '案例图表制作', description: '初步设计主体关系图，后续根据证据继续完善。', status: 'done', assignee_id: null, due_date: null },
    ],
    notes: [],
    activities: [{ id: 'welcome', team_id: DEMO_TEAM, user_id: DEMO_USER, action: '初始化了演示研究工作台', entity_title: '示例任务与两篇经典文献题录', created_at: now }],
  }
}
