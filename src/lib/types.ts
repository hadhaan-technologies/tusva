export type Role = 'student'|'faculty'|'admin'
export type Profile = { id:string; role:Role; full_name:string; institutional_email:string; active:boolean; usn?:string|null; branch_id?:string|null; semester?:number|null; academic_year?:string|null }
