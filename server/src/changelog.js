const { getAdmin } = require('./supabase');

// บันทึกประวัติการแก้ไข: ใคร · เมื่อไร · ค่าก่อน · ค่าหลัง (B4.3)
async function logChange({ table, recordId, action, actor, before = null, after = null }) {
  const { error } = await getAdmin().from('change_log').insert({
    table_name: table,
    record_id: String(recordId),
    action,
    actor_email: actor.email,
    before_data: before,
    after_data: after,
  });
  if (error) console.error('[changelog] บันทึกไม่สำเร็จ:', error.code); // ไม่ log เนื้อหาข้อมูล
}

module.exports = { logChange };
