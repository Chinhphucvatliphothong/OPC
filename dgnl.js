/**
 * FaradayAI.vn - Module Đánh Giá Năng Lực (ĐGNL) - Version 2.0
 * Features: Adaptive Test, Flexible Duration (45m/75m/150m), History & Detailed Review Mode
 */

let dgnlCurrentExam = null;
let dgnlTimerInterval = null;
let dgnlTimeRemaining = 0;
let dgnlUserAnswers = {};
let selectedDurationMinutes = 150; // Mặc định 150 phút

// Kho lưu trữ đề gốc chuẩn 150 phút
const DGNL_EXAM_BANK = {
  id: "dgnl_thpt_standard_01",
  title: "Đề Thi Đánh Giá Năng Lực - Mẫu Chuẩn",
  description: "Đề thi tổng hợp kiến thức ĐGNL ĐHQG TP.HCM / Hà Nội",
  totalTimeMinutes: 150,
  questions: [
    {
      id: "q1",
      section: "Vật lý",
      content: "Một con lắc đơn có chiều dài $l = 1\text{ m}$ dao động điều hòa tại nơi có $g = \pi^2 = 10\text{ m/s}^2$. Chu kỳ dao động của con lắc là:",
      options: [
        { key: "A", text: "$T = 2\text{ s}$" },
        { key: "B", text: "$T = 1\text{ s}$" },
        { key: "C", text: "$T = 0{,}5\text{ s}$" },
        { key: "D", text: "$T = 4\text{ s}$" }
      ],
      correctAnswer: "A",
      explanation: "Công thức tính chu kỳ con lắc đơn: $T = 2\pi \sqrt{\frac{l}{g}} = 2\pi \sqrt{\frac{1}{\pi^2}} = 2\text{ s}$."
    },
    {
      id: "q2",
      section: "Vật lý",
      content: "Trong hiện tượng giao thoa sóng nước với hai nguồn cùng pha, những điểm trong vùng giao thoa cực đại có hiệu đường đi $\Delta d$ thỏa mãn:",
      options: [
        { key: "A", text: "$\Delta d = k\lambda$ với $k \in \mathbb{Z}$" },
        { key: "B", text: "$\Delta d = \left(k + 0{,}5\right)\lambda$ với $k \in \mathbb{Z}$" },
        { key: "C", text: "$\Delta d = 2k\lambda$ với $k \in \mathbb{Z}$" },
        { key: "D", text: "$\Delta d = \left(2k + 1\right)\lambda$ với $k \in \mathbb{Z}$" }
      ],
      correctAnswer: "A",
      explanation: "Điều kiện cực đại giao thoa hai nguồn cùng pha là hiệu đường đi bằng một số nguyên lần bước sóng: $\Delta d = k\lambda$."
    }
  ]
};

function selectExamTime(minutes) {
  selectedDurationMinutes = minutes;
  document.querySelectorAll('.btn-time-opt').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
  });
  const timeNotice = document.getElementById('selected-time-notice');
  if(timeNotice) {
    timeNotice.innerText = `Bạn đang chọn chế độ thi ${minutes} phút (Đề thích ứng tự động căn chỉnh số lượng câu hỏi).`;
  }
}

function generateAdaptiveDGNLExam(baseExam, targetMinutes) {
  const ratio = targetMinutes / 150;
  const originalQuestions = baseExam.questions;
  let targetCount = Math.round(originalQuestions.length * ratio);
  if (targetCount < 2) targetCount = originalQuestions.length;
  const shuffled = [...originalQuestions].sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, targetCount);

  return {
    id: `dgnl_adaptive_${targetMinutes}m_${Date.now()}`,
    title: `${baseExam.title} (${targetMinutes} Phút)`,
    durationMinutes: targetMinutes,
    timeLimitSeconds: targetMinutes * 60,
    questions: selectedQuestions
  };
}
