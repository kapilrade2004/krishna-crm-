'use strict';

require('dotenv').config();
const { User, Employee, EmployeeDocument, PayrollProfile, PayrollRecord, syncModels } = require('../models');

async function testEmployeeHR() {
  console.log('🧪 Testing Employee Management & HR Module End-to-End...');

  await syncModels();

  const timestamp = Date.now();
  const testEmail = `hr_test_${timestamp}@krishnacrm.com`;

  // 1. Create a linked User (Security Layer)
  console.log('1️⃣ Creating User Account (Security Layer)...');
  const user = await User.create({
    name: 'Ananya Sharma',
    email: testEmail,
    password: 'Password@123',
    phone: '9876543210',
    role: 'sales',
    status: 'active',
    is_active: true,
  });
  console.log(`   ✅ User created: ${user.id} (${user.email})`);

  // 2. Create Employee Profile (Employment Layer)
  console.log('2️⃣ Creating Linked Employee Profile (Employment Layer)...');
  const employee = await Employee.create({
    user_id: user.id,
    employee_code: `EMP-HR-${timestamp.toString().slice(-4)}`,
    first_name: 'Ananya',
    last_name: 'Sharma',
    email: testEmail,
    phone: '9876543210',
    department: 'Sales',
    designation: 'Sales Executive',
    date_of_joining: '2026-08-01',
    probation_end_date: '2026-11-01',
    confirmation_date: '2026-11-02',
    employment_type: 'full_time',
    work_location: 'Mumbai HQ',
    salary: 35000.00,
    bank_name: 'HDFC Bank',
    bank_account_number: '50100123456789',
    bank_ifsc: 'HDFC0001234',
    pan_number: 'ABCDE1234F',
    status: 'active',
    onboarding_status: 'pending',
  });
  console.log(`   ✅ Employee created: ${employee.id} (${employee.employee_code})`);

  // 3. Test Mandatory Document Upload & Verification
  console.log('3️⃣ Testing Document Checklist & Verification...');
  const doc = await EmployeeDocument.create({
    employee_id: employee.id,
    uploaded_by: user.id,
    document_type: 'aadhaar_card',
    document_name: 'Aadhaar Card copy',
    original_name: 'aadhaar.pdf',
    file_path: 'uploads/documents/dummy_aadhaar.pdf',
    file_size: 102400,
    mime_type: 'application/pdf',
    status: 'under_review',
  });
  console.log(`   ✅ Document uploaded: ${doc.id} (Status: ${doc.status})`);

  doc.status = 'verified';
  doc.verified_by = user.id;
  doc.verified_at = new Date();
  await doc.save();
  console.log(`   ✅ Document verified successfully.`);

  // 4. Test Payroll Compensation Profile Setup
  console.log('4️⃣ Testing Payroll Profile Configuration...');
  const payrollProfile = await PayrollProfile.create({
    employee_id: employee.id,
    salary_type: 'monthly',
    basic_salary: 35000.00,
    fixed_allowances: 10000.00,
    fixed_deductions: 2500.00,
    net_payable_reference: 42500.00,
    effective_from: '2026-08-01',
    payment_method: 'bank_transfer',
    bank_name: 'HDFC Bank',
    bank_account_reference: '50100123456789',
    bank_ifsc: 'HDFC0001234',
    pan_number: 'ABCDE1234F',
    status: 'active',
  });
  console.log(`   ✅ Payroll profile created: Net Reference = ₹${payrollProfile.net_payable_reference}`);

  // 5. Test Monthly Payroll Record (Payslip Generation)
  console.log('5️⃣ Testing Monthly Payroll Record Generation...');
  const payrollRecord = await PayrollRecord.create({
    employee_id: employee.id,
    payroll_month: '2026-08',
    gross_amount: 45000.00,
    allowances: 10000.00,
    deductions: 2500.00,
    net_amount: 42500.00,
    payment_status: 'approved',
    processed_by: user.id,
    processed_at: new Date(),
    payment_method: 'bank_transfer',
    remarks: 'August 2026 Salary',
  });
  console.log(`   ✅ Payroll record created: ${payrollRecord.id} (Month: ${payrollRecord.payroll_month}, Net: ₹${payrollRecord.net_amount})`);

  // 6. Test Offboarding Workflow
  console.log('6️⃣ Testing Offboarding Workflow (Preserving Historical Records)...');
  employee.status = 'terminated';
  employee.exit_date = '2026-08-31';
  employee.exit_reason = 'resigned';
  employee.handover_notes = 'Completed handover of assigned customer accounts and sales materials to Amit.';
  employee.offboarded_by = user.id;
  employee.offboarded_at = new Date();
  await employee.save();

  // Linked User account deactivated and tokens revoked
  user.is_active = false;
  user.status = 'inactive';
  user.refresh_token = null;
  await user.save();

  console.log(`   ✅ Employee offboarded: status=${employee.status}, exit_date=${employee.exit_date}`);
  console.log(`   ✅ User account deactivated: is_active=${user.is_active}, status=${user.status}`);

  // Clean up test records
  await payrollRecord.destroy();
  await payrollProfile.destroy();
  await doc.destroy();
  await employee.destroy();
  await user.destroy();

  console.log('🎉 All Employee Management & HR Module Backend Tests PASSED successfully!');
}

if (require.main === module) {
  testEmployeeHR()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}
