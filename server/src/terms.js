const { getAdmin } = require('./supabase');

// ภาคเรียนทั้งหมด เรียงใหม่ → เก่า · is_current มาจาก view v_terms (อิงวันส่งออกข้อมูล)
async function loadTerms() {
  const { data, error } = await getAdmin().from('v_terms').select('term_id, is_current, sort_key, start_date, end_date').order('sort_key', { ascending: false });
  if (error) throw error;
  return data;
}

module.exports = { loadTerms };
