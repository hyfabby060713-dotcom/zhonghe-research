export const TAGS = ['乡村治理', '基层干部', '协同治理', '嵌入性治理', '乡村产业发展', '公共管理案例'] as const
export const THEORIES = ['嵌入性治理', '社会角色', '协同治理'] as const
export type Status = 'todo' | 'doing' | 'done'
export const STATUS_LABELS: Record<Status, string> = { todo: '待完成', doing: '进行中', done: '已完成' }
export type Member = { user_id: string; display_name: string; team_id: string }
export type Literature = {
  id: string; team_id: string; title: string; authors: string; journal: string; year: number;
  keywords: string[]; tags: string[]; theory_tags: string[]; source_url: string;
  file_path: string | null; file_name: string | null; file_size: number | null;
  created_by: string; created_at: string; updated_at: string
}
export type LiteratureInput = Pick<Literature, 'title' | 'authors' | 'journal' | 'year' | 'keywords' | 'tags' | 'theory_tags' | 'source_url'>
export type ReadingNote = {
  id: string; team_id: string; literature_id: string; user_id: string;
  application: string; core_ideas: string; theory_support: string; updated_at: string
}
export type NoteInput = Pick<ReadingNote, 'application' | 'core_ideas' | 'theory_support'>
export type Task = {
  id: string; team_id: string; title: string; description: string; status: Status;
  assignee_id: string | null; due_date: string | null; created_by: string; created_at: string; updated_at: string
}
export type TaskInput = Pick<Task, 'title' | 'description' | 'status' | 'assignee_id' | 'due_date'>
export type Activity = { id: string; team_id: string; user_id: string | null; action: string; entity_title: string; created_at: string }
export type Snapshot = { literature: Literature[]; tasks: Task[]; notes: ReadingNote[]; members: Member[]; activities: Activity[] }
