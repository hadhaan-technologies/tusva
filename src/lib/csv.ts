export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i=0;i<text.length;i++) {
    const char=text[i]
    if(quoted){if(char==='"'&&text[i+1]==='"'){cell+='"';i++}else if(char==='"')quoted=false;else cell+=char}
    else if(char==='"'&&cell==='')quoted=true
    else if(char===','){row.push(cell);cell=''}
    else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some((v)=>v.trim()))rows.push(row);row=[];cell=''}
    else cell+=char
  }
  if(quoted)throw new Error('CSV has an unclosed quoted field.')
  if(cell.length||row.length){row.push(cell);if(row.some((v)=>v.trim()))rows.push(row)}
  return rows
}
export function parseAccountCsv(text:string){
  const rows=parseCsv(text)
  if(rows.length<2)throw new Error('CSV needs a header row and at least one account.')
  const headers=rows[0].map((h)=>h.trim().toLowerCase())
  for(const required of ['full_name','institutional_email','role'])if(!headers.includes(required))throw new Error(`CSV is missing the required “${required}” column.`)
  return rows.slice(1).map((values,index)=>{
    const row=Object.fromEntries(headers.map((header,i)=>[header,(values[i]??'').trim()]))
    return {row:index+2,fullName:row.full_name,email:row.institutional_email,role:row.role.toLowerCase(),usn:row.usn||undefined,branchCode:row.branch_code||undefined,semester:row.semester?Number(row.semester):undefined,academicYear:row.academic_year||undefined,courseCodes:row.course_codes?row.course_codes.split(';').map((code:string)=>code.trim().toUpperCase()).filter(Boolean):[]}
  })
}
