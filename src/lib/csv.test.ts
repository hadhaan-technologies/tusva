import { describe,expect,it } from 'vitest'
import { parseAccountCsv,parseCsv } from './csv'
describe('CSV account imports',()=>{
  it('parses quoted commas, escaped quotes and multiline cells',()=>{expect(parseCsv('a,b\n"Smith, Jane","said ""hello"""\n"multi\nline",x')).toEqual([['a','b'],['Smith, Jane','said "hello"'],['multi\nline','x']])})
  it('maps account headers and semicolon-separated course codes',()=>{expect(parseAccountCsv('full_name,institutional_email,role,usn,course_codes\nAda Lovelace,ada@college.edu,student,AB123,CS101;MA102')[0]).toMatchObject({fullName:'Ada Lovelace',email:'ada@college.edu',role:'student',usn:'AB123',courseCodes:['CS101','MA102']})})
  it('rejects an unclosed quote and missing required columns',()=>{expect(()=>parseCsv('a,b\n"x,y')).toThrow(/unclosed/);expect(()=>parseAccountCsv('full_name,email\nA,a@b.com')).toThrow(/institutional_email/)})
})
