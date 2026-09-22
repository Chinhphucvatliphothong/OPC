/**
 * OPC Luyện Thi Vật Lí - PrepScholar Adaptive Learning Engine
 * Mô phỏng toàn diện cơ chế học thích ứng thông minh của PrepScholar:
 * 1. Đánh giá chẩn đoán & Đo lường năng lực (% Mastery theo chuyên đề)
 * 2. Luyện tập tập trung (Focused Drill) theo điểm yếu nhất
 * 3. Sổ tay câu sai & Lặp lại giãn cách (Adaptive Spaced Repetition)
 * 4. Thi thử bấm giờ chuẩn cấu trúc Bộ GD&ĐT (Phần I, II, III)
 * 5. Chấm điểm tức thì & Lời giải chi tiết từng bước (\loigiai)
 */

(function(window){
  'use strict';

  var CHU_DE_MAP = {
    'nhiet': { name: 'Vật lí nhiệt', icon: '🔥', defaultMastery: 85 },
    'khi': { name: 'Khí lí tưởng', icon: '💨', defaultMastery: 68 },
    'tu-truong': { name: 'Từ trường & Cảm ứng điện từ', icon: '🧲', defaultMastery: 60 },
    'hat-nhan': { name: 'Vật lí hạt nhân', icon: '⚛️', defaultMastery: 42 }
  };

  // Ngân hàng câu hỏi mẫu chuẩn hoá Vật lí 12 theo chương trình mới 2025 - 2026
  var QUESTION_BANK = [
    // === VẬT LÍ NHIỆT ===
    {
      id: 'q_nhiet_01',
      topicKey: 'nhiet',
      topicName: 'Vật lí nhiệt',
      subtopic: 'Nội năng & Định luật I Nhiệt động lực học',
      part: 'I',
      level: 'M1',
      stem: 'Trong hệ thức của định luật I nhiệt động lực học $\\Delta U = A + Q$, quy ước dấu nào sau đây là **chính xác**?',
      options: [
        { key: 'A', text: '$Q > 0$: Hệ truyền nhiệt lượng cho môi trường bên ngoài.' },
        { key: 'B', text: '$A > 0$: Hệ nhận công từ các ngoại lực bên ngoài.' },
        { key: 'C', text: '$A < 0$: Ngoại lực thực hiện công lên hệ.' },
        { key: 'D', text: '$Q < 0$: Hệ nhận nhiệt lượng từ môi trường bên ngoài.' }
      ],
      correctKey: 'B',
      loiGiai: 'Theo quy ước dấu chuẩn của Định luật I Nhiệt động lực học: Nếu hệ nhận công hoặc nhận nhiệt thì đại lượng đó mang dấu dương ($A > 0, Q > 0$). Nếu hệ sinh công hoặc truyền nhiệt thì mang dấu âm ($A < 0, Q < 0$). Do đó, $A > 0$ ứng với hệ nhận công từ ngoại lực.',
      trapTip: 'Học sinh rất hay nhầm giữa "hệ thực hiện công" ($A < 0$) và "hệ nhận công" ($A > 0$). Luôn nhớ nguyên tắc: "Nhận là cộng (+), Cho/Sinh là trừ (-)".'
    },
    {
      id: 'q_nhiet_02',
      topicKey: 'nhiet',
      topicName: 'Vật lí nhiệt',
      subtopic: 'Nhiệt dung riêng & Nhiệt nóng chảy riêng',
      part: 'I',
      level: 'M2',
      stem: 'Biết nhiệt nóng chảy riêng của nước đá là $\\lambda = 3{,}34 \\cdot 10^5\\text{ J/kg}$. Nhiệt lượng cần cung cấp để làm nóng chảy hoàn toàn một khối nước đá có khối lượng $1{,}5\\text{ kg}$ ở $0^\\circ\\text{C}$ là:',
      options: [
        { key: 'A', text: '$5{,}01 \\cdot 10^5\\text{ J}$' },
        { key: 'B', text: '$2{,}23 \\cdot 10^5\\text{ J}$' },
        { key: 'C', text: '$3{,}34 \\cdot 10^5\\text{ J}$' },
        { key: 'D', text: '$6{,}68 \\cdot 10^5\\text{ J}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Áp dụng công thức nhiệt lượng trong quá trình nóng chảy ở nhiệt độ xác định: $Q = m \\cdot \\lambda = 1{,}5 \\cdot 3{,}34 \\cdot 10^5 = 5{,}01 \\cdot 10^5\\text{ J}$.',
      trapTip: 'Chú ý không cộng thêm công thức $Q = m c \\Delta t$ vì đề bài chỉ rõ nước đá đang ở đúng nhiệt độ nóng chảy $0^\\circ\\text{C}$.'
    },
    {
      id: 'q_nhiet_03',
      topicKey: 'nhiet',
      topicName: 'Vật lí nhiệt',
      subtopic: 'Nhiệt hóa hơi & Hiệu suất bếp đun',
      part: 'II',
      level: 'M3',
      stem: 'Một ấm điện công suất định mức $P = 1000\\text{ W}$ dùng để đun sôi và làm bay hơi nước. Cho biết nhiệt dung riêng của nước $c = 4200\\text{ J/(kg}\\cdot\\text{K)}$, nhiệt hoá hơi riêng của nước $L = 2{,}26 \\cdot 10^6\\text{ J/kg}$. Ban đầu ấm chứa $1\\text{ kg}$ nước ở nhiệt độ $20^\\circ\\text{C}$, hiệu suất của ấm là $80\\%$. Đánh giá tính **ĐÚNG / SAI** của các nhận định sau:',
      statements: [
        { key: 'a', text: 'Nhiệt lượng cần cung cấp để đưa $1\\text{ kg}$ nước từ $20^\\circ\\text{C}$ đến khi bắt đầu sôi ($100^\\circ\\text{C}$) là $336\\text{ kJ}$.', isTrue: true },
        { key: 'b', text: 'Thời gian đun để nước bắt đầu sôi là $336\\text{ giây}$.', isTrue: false },
        { key: 'c', text: 'Nếu tiếp tục đun thêm $565\\text{ giây}$ sau khi sôi, khối lượng nước đã hoá hơi là $0{,}2\\text{ kg}$.', isTrue: true },
        { key: 'd', text: 'Nhiệt lượng toả ra môi trường xung quanh trong suốt quá trình đun sôi từ $20^\\circ\\text{C}$ là $84\\text{ kJ}$.', isTrue: true }
      ],
      loiGiai: 'Phân tích chi tiết từng mệnh đề:\n- a) ĐÚNG: $Q_1 = m c \\Delta t = 1 \\cdot 4200 \\cdot (100 - 20) = 336000\\text{ J} = 336\\text{ kJ}$.\n- b) SAI: Vì hiệu suất $H = 80\\%$ nên công suất nhiệt có ích là $P_{ci} = H \\cdot P = 0{,}8 \\cdot 1000 = 800\\text{ W}$. Do đó $t = \\frac{Q_1}{P_{ci}} = \\frac{336000}{800} = 420\\text{ giây}$.\n- c) ĐÚNG: Nhiệt lượng có ích sau 565s là $Q_2 = P_{ci} \\cdot t_2 = 800 \\cdot 565 = 452000\\text{ J}$. Khối lượng bay hơi $m_{hh} = \\frac{Q_2}{L} = \\frac{452000}{2{,}26 \\cdot 10^6} = 0{,}2\\text{ kg}$.\n- d) ĐÚNG: Nhiệt toàn phần $Q_{tp} = \\frac{Q_1}{H} = \\frac{336}{0{,}8} = 420\\text{ kJ}$. Nhiệt toả ra môi trường: $\\Delta Q = Q_{tp} - Q_1 = 420 - 336 = 84\\text{ kJ}$.',
      trapTip: 'Nhớ phân biệt công suất toàn phần của ấm ($1000\\text{ W}$) và công suất nhiệt có ích truyền vào nước ($800\\text{ W}$).'
    },
    {
      id: 'q_nhiet_04',
      topicKey: 'nhiet',
      topicName: 'Vật lí nhiệt',
      subtopic: 'Độ biến thiên nội năng khối khí',
      part: 'III',
      level: 'M2',
      stem: 'Một khối khí lí tưởng bị nén trong xilanh, nhận công $180\\text{ J}$ từ ngoại lực, đồng thời khối khí truyền ra môi trường xung quanh một nhiệt lượng $65\\text{ J}$. Độ biến thiên nội năng của khối khí bằng bao nhiêu Jun?',
      correctAnswer: 115,
      tolerance: 0.5,
      unit: 'J',
      loiGiai: 'Khối khí nhận công từ ngoại lực nên $A = +180\\text{ J}$. Khối khí truyền nhiệt lượng ra ngoài nên $Q = -65\\text{ J}$. Theo định luật I nhiệt động lực học: $\\Delta U = A + Q = 180 + (-65) = 115\\text{ J}$.',
      trapTip: 'Cần chú ý dấu của nhiệt lượng: truyền ra ngoài môi trường thì $Q < 0$.'
    },

    // === KHÍ LÍ TƯỞNG ===
    {
      id: 'q_khi_01',
      topicKey: 'khi',
      topicName: 'Khí lí tưởng',
      subtopic: 'Định luật Boyle (Đẳng nhiệt)',
      part: 'I',
      level: 'M1',
      stem: 'Đối với một khối lượng khí lí tưởng xác định, trong quá trình biến đổi trạng thái đẳng nhiệt, hệ thức nào sau đây diễn tả **định luật Boyle**?',
      options: [
        { key: 'A', text: '$p \\cdot V = \\text{hằng số}$' },
        { key: 'B', text: '$\\frac{p}{V} = \\text{hằng số}$' },
        { key: 'C', text: '$\\frac{V}{T} = \\text{hằng số}$' },
        { key: 'D', text: '$p \\cdot T = \\text{hằng số}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Định luật Boyle: Trong quá trình đẳng nhiệt của một lượng khí nhất định, áp suất tỉ lệ nghịch với thể tích: $p \\propto \\frac{1}{V} \\Leftrightarrow p \\cdot V = \\text{hằng số}$ (hay $p_1 V_1 = p_2 V_2$).',
      trapTip: 'Phân biệt đẳng nhiệt (Boyle: $p V = \\text{const}$), đẳng tích (Charles: $p/T = \\text{const}$), đẳng áp (Gay-Lussac: $V/T = \\text{const}$).'
    },
    {
      id: 'q_khi_02',
      topicKey: 'khi',
      topicName: 'Khí lí tưởng',
      subtopic: 'Định luật Charles & Khí thực nghiệm',
      part: 'I',
      level: 'M2',
      stem: 'Một khối khí lí tưởng ở nhiệt độ $27^\\circ\\text{C}$ có thể tích $6\\text{ lít}$ dưới áp suất $1\\text{ atm}$. Khi nén đẳng áp đến thể tích $4\\text{ lít}$, nhiệt độ tuyệt đối của khối khí khi đó bằng:',
      options: [
        { key: 'A', text: '$200\\text{ K}$' },
        { key: 'B', text: '$150\\text{ K}$' },
        { key: 'C', text: '$18^\\circ\\text{C}$' },
        { key: 'D', text: '$300\\text{ K}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Nhiệt độ tuyệt đối ban đầu: $T_1 = 27 + 273 = 300\\text{ K}$.\nQuá trình đẳng áp: $\\frac{V_1}{T_1} = \\frac{V_2}{T_2} \\Rightarrow T_2 = T_1 \\cdot \\frac{V_2}{V_1} = 300 \\cdot \\frac{4}{6} = 200\\text{ K}$.',
      trapTip: 'Bắt buộc phải đổi độ Celsius ($^\\circ\\text{C}$) sang độ Kelvin ($T = t + 273$). Nếu lấy $27 \\cdot (4/6) = 18^\\circ\\text{C}$ là hoàn toàn sai bản chất nhiệt động!'
    },
    {
      id: 'q_khi_03',
      topicKey: 'khi',
      topicName: 'Khí lí tưởng',
      subtopic: 'Phương trình trạng thái Clapeyron & Đồ thị chu trình',
      part: 'II',
      level: 'M3',
      stem: 'Một mol khí lí tưởng đơn nguyên tử thực hiện chu trình biến đổi kín như sau: từ trạng thái (1) ($p_1 = 1\\text{ atm}, V_1 = 22{,}4\\text{ lít}, T_1 = 273\\text{ K}$) sang trạng thái (2) bằng quá trình đẳng tích đến áp suất $p_2 = 2\\text{ atm}$; sau đó sang trạng thái (3) bằng quá trình đẳng nhiệt đến thể tích $V_3 = 44{,}8\\text{ lít}$; cuối cùng trở về (1) bằng quá trình đẳng áp. Đánh giá tính **ĐÚNG / SAI**:',
      statements: [
        { key: 'a', text: 'Nhiệt độ của khối khí ở trạng thái (2) là $546\\text{ K}$.', isTrue: true },
        { key: 'b', text: 'Áp suất của khối khí ở trạng thái (3) là $1{,}5\\text{ atm}$.', isTrue: false },
        { key: 'c', text: 'Trong quá trình từ (1) sang (2), khí không sinh công ($A_{12} = 0$).', isTrue: true },
        { key: 'd', text: 'Tổng biến thiên nội năng của khối khí sau cả chu trình kín $(1) \\to (2) \\to (3) \\to (1)$ là $\\Delta U = 0$.', isTrue: true }
      ],
      loiGiai: 'Phân tích chi tiết:\n- a) ĐÚNG: Quá trình (1) -> (2) đẳng tích: $\\frac{p_1}{T_1} = \\frac{p_2}{T_2} \\Rightarrow T_2 = 273 \\cdot \\frac{2}{1} = 546\\text{ K}$.\n- b) SAI: Quá trình (2) -> (3) đẳng nhiệt: $p_2 V_2 = p_3 V_3 \\Rightarrow p_3 = \\frac{p_2 V_2}{V_3} = \\frac{2 \\cdot 22{,}4}{44{,}8} = 1\\text{ atm}$. (Phù hợp vì từ (3) về (1) là đẳng áp ở $1\\text{ atm}$).\n- c) ĐÚNG: Vì quá trình (1) -> (2) là đẳng tích ($V_1 = V_2$), khí không giãn nở hay bị nén nên công thực hiện $A = 0$.\n- d) ĐÚNG: Vì nội năng $U$ là hàm trạng thái, khi đi hết một chu trình kín quay về trạng thái xuất phát thì $\\Delta U_{toanphan} = 0$.',
      trapTip: 'Luôn nhớ rằng nội năng $U$ phụ thuộc duy nhất vào nhiệt độ $T$ đối với khí lí tưởng, nên sau bất kỳ chu trình kín nào thì $\\Delta U$ luôn bằng 0!'
    },
    {
      id: 'q_khi_04',
      topicKey: 'khi',
      topicName: 'Khí lí tưởng',
      subtopic: 'Số mol khí trong bình kín',
      part: 'III',
      level: 'M3',
      stem: 'Một bình kín dung tích $16{,}4\\text{ lít}$ chứa khí heli ở nhiệt độ $27^\\circ\\text{C}$ và áp suất $3\\text{ atm}$. Lấy hằng số khí lí tưởng $R = 0{,}082\\text{ atm}\\cdot\\text{lít/(mol}\\cdot\\text{K)}$. Lượng khí heli chứa trong bình có số mol bằng bao nhiêu? (Điền số nguyên hoặc số thập phân)',
      correctAnswer: 2,
      tolerance: 0.1,
      unit: 'mol',
      loiGiai: 'Đổi nhiệt độ: $T = 27 + 273 = 300\\text{ K}$.\nÁp dụng phương trình Clapeyron - Mendeleev: $p V = n R T \\Rightarrow n = \\frac{p V}{R T} = \\frac{3 \\cdot 16{,}4}{0{,}082 \\cdot 300} = \\frac{49{,}2}{24{,}6} = 2\\text{ mol}$.',
      trapTip: 'Để ý đơn vị của hằng số $R$: Nếu $p$ tính bằng $\\text{atm}$ và $V$ tính bằng $\\text{lít}$ thì $R = 0{,}082$; nếu dùng hệ SI ($p$ tính bằng $\\text{Pa}$, $V$ tính bằng $\\text{m}^3$) thì $R = 8{,}31\\text{ J/(mol}\\cdot\\text{K)}$.'
    },

    // === TỪ TRƯỜNG & CẢM ỨNG ĐIỆN TỪ ===
    {
      id: 'q_tu_01',
      topicKey: 'tu-truong',
      topicName: 'Từ trường & Cảm ứng điện từ',
      subtopic: 'Lực từ tác dụng lên đoạn dây dẫn',
      part: 'I',
      level: 'M1',
      stem: 'Một đoạn dây dẫn thẳng dài $l = 0{,}2\\text{ m}$ mang dòng điện $I = 5\\text{ A}$ đặt vuông góc với các đường sức từ của một từ trường đều có cảm ứng từ $B = 0{,}04\\text{ T}$. Lực từ tác dụng lên đoạn dây có độ lớn bằng:',
      options: [
        { key: 'A', text: '$0{,}04\\text{ N}$' },
        { key: 'B', text: '$0{,}4\\text{ N}$' },
        { key: 'C', text: '$0{,}02\\text{ N}$' },
        { key: 'D', text: '$0{,}08\\text{ N}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Độ lớn của lực từ tác dụng lên đoạn dây dẫn: $F = B I l \\sin\\alpha$. Vì dây đặt vuông góc với đường sức từ nên $\\alpha = 90^\\circ \\Rightarrow \\sin\\alpha = 1$. Do đó: $F = 0{,}04 \\cdot 5 \\cdot 0{,}2 = 0{,}04\\text{ N}$.',
      trapTip: 'Góc $\\alpha$ là góc hợp bởi đoạn dòng điện và vectơ cảm ứng từ $\\vec{B}$.'
    },
    {
      id: 'q_tu_02',
      topicKey: 'tu-truong',
      topicName: 'Từ trường & Cảm ứng điện từ',
      subtopic: 'Từ thông & Định luật Faraday',
      part: 'I',
      level: 'M2',
      stem: 'Một khung dây phẳng kín có diện tích $S = 50\\text{ cm}^2$ gồm $100\\text{ vòng}$ dây. Khung được đặt trong từ trường đều vuông góc với mặt phẳng khung dây. Trong khoảng thời gian $0{,}05\\text{ giây}$, cảm ứng từ giảm đều từ $0{,}6\\text{ T}$ về $0{,}1\\text{ T}$. Suất điện động cảm ứng xuất hiện trong khung dây có độ lớn là:',
      options: [
        { key: 'A', text: '$5\\text{ V}$' },
        { key: 'B', text: '$2{,}5\\text{ V}$' },
        { key: 'C', text: '$50\\text{ V}$' },
        { key: 'D', text: '$0{,}5\\text{ V}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Đổi diện tích: $S = 50\\text{ cm}^2 = 50 \\cdot 10^{-4}\\text{ m}^2 = 5 \\cdot 10^{-3}\\text{ m}^2$.\nĐộ biến thiên từ thông qua 1 vòng dây: $|\\Delta \\Phi_1| = |\\Delta B| \\cdot S = (0{,}6 - 0{,}1) \\cdot 5 \\cdot 10^{-3} = 2{,}5 \\cdot 10^{-3}\\text{ Wb}$.\nSuất điện động cảm ứng trong toàn khung gồm $N = 100$ vòng: $|e_c| = N \\frac{|\\Delta \\Phi_1|}{\\Delta t} = 100 \\cdot \\frac{2{,}5 \\cdot 10^{-3}}{0{,}05} = 5\\text{ V}$.',
      trapTip: 'Nhớ đổi $\\text{cm}^2$ sang $\\text{m}^2$ ($1\\text{ cm}^2 = 10^{-4}\\text{ m}^2$) và đừng quên nhân với số vòng dây $N = 100$.'
    },
    {
      id: 'q_tu_03',
      topicKey: 'tu-truong',
      topicName: 'Từ trường & Cảm ứng điện từ',
      subtopic: 'Khung dây quay trong từ trường',
      part: 'II',
      level: 'M3',
      stem: 'Một khung dây dẫn phẳng diện tích $S = 100\\text{ cm}^2$ gồm $200\\text{ vòng}$ dây quay đều với tốc độ góc $\\omega = 100\\pi\\text{ rad/s}$ quanh một trục đối xứng nằm trong mặt phẳng khung, trong một từ trường đều có vectơ cảm ứng từ vuông góc với trục quay, độ lớn $B = 0{,}1\\text{ T}$. Đánh giá tính **ĐÚNG / SAI** của các phát biểu sau:',
      statements: [
        { key: 'a', text: 'Từ thông cực đại gửi qua toàn bộ khung dây là $\\Phi_0 = 0{,}2\\text{ Wb}$.', isTrue: true },
        { key: 'b', text: 'Tần số của suất điện động xoay chiều tạo ra trong khung dây là $50\\text{ Hz}$.', isTrue: true },
        { key: 'c', text: 'Suất điện động cực đại xuất hiện trong khung dây xấp xỉ bằng $62{,}8\\text{ V}$.', isTrue: true },
        { key: 'd', text: 'Tại thời điểm từ thông qua khung đạt giá trị cực đại, độ lớn suất điện động cảm ứng cũng đạt giá trị cực đại.', isTrue: false }
      ],
      loiGiai: 'Phân tích chi tiết:\n- a) ĐÚNG: $\\Phi_0 = N B S = 200 \\cdot 0{,}1 \\cdot (100 \\cdot 10^{-4}) = 0{,}2\\text{ Wb}$.\n- b) ĐÚNG: Tần số $f = \\frac{\\omega}{2\\pi} = \\frac{100\\pi}{2\\pi} = 50\\text{ Hz}$.\n- c) ĐÚNG: $E_0 = \\omega \\cdot \\Phi_0 = 100\\pi \\cdot 0{,}2 = 20\\pi \\approx 62{,}83\\text{ V}$.\n- d) SAI: Suất điện động cảm ứng $e = -\\Phi\'(t)$, do đó suất điện động luôn vuông pha (lệch pha $\\pi/2$) so với từ thông $\\Phi$. Khi $\\Phi$ đạt cực đại thì tốc độ biến thiên bằng 0, do đó $e = 0$!',
      trapTip: 'Quy tắc pha cốt lõi: $e$ vuông pha với $\\Phi$. Khi đại lượng này cực đại thì đại lượng kia triệt tiêu (bằng 0)!'
    },
    {
      id: 'q_tu_04',
      topicKey: 'tu-truong',
      topicName: 'Từ trường & Cảm ứng điện từ',
      subtopic: 'Suất điện động cảm ứng trong đoạn dây chuyển động',
      part: 'III',
      level: 'M2',
      stem: 'Một thanh dẫn kim loại dài $0{,}4\\text{ m}$ chuyển động tịnh tiến với vận tốc không đổi $5\\text{ m/s}$ theo phương vuông góc với chiều dài của nó và vuông góc với các đường sức của từ trường đều có $B = 0{,}5\\text{ T}$. Suất điện động cảm ứng sinh ra giữa hai đầu thanh có độ lớn bằng bao nhiêu Vôn?',
      correctAnswer: 1,
      tolerance: 0.05,
      unit: 'V',
      loiGiai: 'Suất điện động cảm ứng xuất hiện trong đoạn dây chuyển động cắt các đường sức từ: $e_c = B v l \\sin\\theta$. Do các vectơ vuông góc đôi một nên $\\sin\\theta = 1$. Suy ra: $e_c = 0{,}5 \\cdot 5 \\cdot 0{,}4 = 1{,}0\\text{ V}$.',
      trapTip: 'Nếu thanh chuyển động song song với đường sức từ thì không cắt đường sức từ nào, khi đó $e_c = 0$.'
    },

    // === VẬT LÍ HẠT NHÂN ===
    {
      id: 'q_hn_01',
      topicKey: 'hat-nhan',
      topicName: 'Vật lí hạt nhân',
      subtopic: 'Cấu tạo hạt nhân & Độ hụt khối',
      part: 'I',
      level: 'M1',
      stem: 'Hạt nhân chì $^{206}_{82}\\text{Pb}$ có cấu tạo gồm:',
      options: [
        { key: 'A', text: '$82\\text{ proton}$ và $124\\text{ neutron}$' },
        { key: 'B', text: '$82\\text{ proton}$ và $206\\text{ neutron}$' },
        { key: 'C', text: '$124\\text{ proton}$ và $82\\text{ neutron}$' },
        { key: 'D', text: '$82\\text{ proton}$ và $82\\text{ neutron}$' }
      ],
      correctKey: 'A',
      loiGiai: 'Kí hiệu hạt nhân $^A_Z X$: Số proton là $Z = 82$, số nucleon (số khối) là $A = 206$. Số neutron là $N = A - Z = 206 - 82 = 124$.',
      trapTip: 'Đừng nhầm lẫn số khối $A$ (tổng proton + neutron) với số neutron $N$.'
    },
    {
      id: 'q_hn_02',
      topicKey: 'hat-nhan',
      topicName: 'Vật lí hạt nhân',
      subtopic: 'Năng lượng liên kết riêng & Độ bền vững',
      part: 'I',
      level: 'M2',
      stem: 'Đại lượng nào sau đây đặc trưng cho mức độ **bền vững** của một hạt nhân nguyên tử?',
      options: [
        { key: 'A', text: 'Năng lượng liên kết riêng của hạt nhân.' },
        { key: 'B', text: 'Độ hụt khối của hạt nhân.' },
        { key: 'C', text: 'Năng lượng liên kết toàn phần của hạt nhân.' },
        { key: 'D', text: 'Số khối $A$ của hạt nhân.' }
      ],
      correctKey: 'A',
      loiGiai: 'Mức độ bền vững của hạt nhân được đo bằng năng lượng liên kết riêng (năng lượng liên kết tính trên một nucleon: $\\varepsilon = \\frac{\\Delta E}{A}$). Hạt nhân có năng lượng liên kết riêng càng lớn thì càng bền vững (bền nhất là các hạt nhân có số khối trong khoảng $50 < A < 70$ như sắt, niken).',
      trapTip: 'Rất nhiều học sinh chọn nhầm "Năng lượng liên kết". Một hạt nhân nặng như Uran có năng lượng liên kết lớn nhưng kém bền vững hơn hạt nhân sắt $^{56}_{26}\\text{Fe}$ vì năng lượng liên kết riêng của sắt cao hơn!'
    },
    {
      id: 'q_hn_03',
      topicKey: 'hat-nhan',
      topicName: 'Vật lí hạt nhân',
      subtopic: 'Định luật phóng xạ & Chu kỳ bán rã',
      part: 'II',
      level: 'M3',
      stem: 'Đồng vị phóng xạ iot $^{131}_{53}\\text{I}$ dùng trong y tế để điều trị bướu cổ có chu kỳ bán rã $T = 8\\text{ ngày đêm}$. Ban đầu có $16\\text{ mg}$ iot $^{131}_{53}\\text{I}$ nguyên chất. Đánh giá tính **ĐÚNG / SAI** của các mệnh đề sau:',
      statements: [
        { key: 'a', text: 'Sau $16\\text{ ngày đêm}$, lượng iot $^{131}\\text{I}$ còn lại chưa bị phân rã là $4\\text{ mg}$.', isTrue: true },
        { key: 'b', text: 'Sau $24\\text{ ngày đêm}$, tỉ số giữa số hạt nhân đã phân rã và số hạt nhân còn lại là $7 : 1$.', isTrue: true },
        { key: 'c', text: 'Hằng số phóng xạ của iot $^{131}\\text{I}$ tính theo đơn vị $\\text{ngày}^{-1}$ là $\\lambda \\approx 0{,}125\\text{ ngày}^{-1}$.', isTrue: false },
        { key: 'd', text: 'Nếu để mẫu chất trong môi trường nhiệt độ cao $1000^\\circ\\text{C}$ hoặc áp suất cực lớn thì chu kỳ bán rã sẽ bị rút ngắn.', isTrue: false }
      ],
      loiGiai: 'Phân tích chi tiết:\n- a) ĐÚNG: Thời gian $t = 16\\text{ ngày} = 2T$. Khối lượng còn lại: $m = m_0 \\cdot 2^{-t/T} = 16 \\cdot 2^{-2} = 4\\text{ mg}$.\n- b) ĐÚNG: Sau $t = 24\\text{ ngày} = 3T$, lượng còn lại là $N = N_0 / 2^3 = N_0 / 8$. Lượng đã phân rã là $\\Delta N = N_0 - N_0/8 = 7 N_0/8$. Do đó tỉ số $\\frac{\\Delta N}{N} = \\frac{7/8}{1/8} = 7$.\n- c) SAI: Hằng số phóng xạ $\\lambda = \\frac{\\ln 2}{T} = \\frac{0{,}693}{8} \\approx 0{,}0866\\text{ ngày}^{-1}$ chứ không phải $0{,}125$.\n- d) SAI: Hiện tượng phóng xạ xảy ra hoàn toàn tự phát từ bên trong hạt nhân, chu kỳ bán rã và hằng số phóng xạ hoàn toàn KHÔNG phụ thuộc vào các điều kiện bên ngoài như nhiệt độ, áp suất, trạng thái hoá học!',
      trapTip: 'Ghi nhớ nguyên tắc: Các yếu tố vật lý và hoá học thông thường (đun nóng, nén áp suất, cho phản ứng axit/bazơ) không bao giờ thay đổi được tốc độ phân rã phóng xạ!'
    },
    {
      id: 'q_hn_04',
      topicKey: 'hat-nhan',
      topicName: 'Vật lí hạt nhân',
      subtopic: 'Tính năng lượng liên kết của hạt Heli',
      part: 'III',
      level: 'M3',
      stem: 'Cho khối lượng của hạt nhân heli $^{4}_{2}\\text{He}$ là $m_{\\alpha} = 4{,}0015\\text{ u}$; khối lượng của proton là $m_p = 1{,}00728\\text{ u}$; khối lượng của neutron là $m_n = 1{,}00866\\text{ u}$. Lấy $1\\text{ u} = 931{,}5\\text{ MeV}/c^2$. Năng lượng liên kết của hạt nhân $^{4}_{2}\\text{He}$ bằng bao nhiêu MeV? (Làm tròn đến 1 chữ số thập phân)',
      correctAnswer: 28.3,
      tolerance: 0.3,
      unit: 'MeV',
      loiGiai: 'Hạt nhân $^{4}_{2}\\text{He}$ gồm 2 proton và 2 neutron.\nTổng khối lượng các nucleon tự do: $m_0 = 2 m_p + 2 m_n = 2 \\cdot 1{,}00728 + 2 \\cdot 1{,}00866 = 4{,}03188\\text{ u}$.\nĐộ hụt khối của hạt nhân: $\\Delta m = m_0 - m_{\\alpha} = 4{,}03188 - 4{,}0015 = 0{,}03038\\text{ u}$.\nNăng lượng liên kết: $E_{lk} = \\Delta m \\cdot c^2 = 0{,}03038 \\cdot 931{,}5 \\approx 28{,}299\\text{ MeV} \\approx 28{,}3\\text{ MeV}$.',
      trapTip: 'Cần giữ đủ các chữ số thập phân khi trừ độ hụt khối trước khi nhân với 931.5 để tránh sai số làm tròn sớm.'
    }
  ];

  // Thuật toán chấm điểm chuẩn Bộ Giáo Dục 2025:
  // - Phần I (Trắc nghiệm 4 chọn 1): 0.25đ / câu
  // - Phần II (Trắc nghiệm Đúng/Sai 4 ý): Đúng 1 ý: 0.1đ; Đúng 2 ý: 0.25đ; Đúng 3 ý: 0.5đ; Đúng 4 ý: 1.0đ
  // - Phần III (Trả lời ngắn): 0.25đ / câu
  function scoreExam(questions, answers){
    var totalMaxScore = 0;
    var totalEarnedScore = 0;
    var correctCount = 0;
    var perQuestionResults = [];
    var topicStats = {};

    Object.keys(CHU_DE_MAP).forEach(function(k){
      topicStats[k] = { total: 0, correct: 0, earnedScore: 0, maxScore: 0 };
    });

    questions.forEach(function(q, idx){
      var tStats = topicStats[q.topicKey] || { total: 0, correct: 0, earnedScore: 0, maxScore: 0 };
      tStats.total++;

      if(q.part === 'I'){
        var maxPt = 0.25;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var userChoice = answers[q.id];
        var isRight = (userChoice === q.correctKey);
        var earnedPt = isRight ? maxPt : 0;
        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        if(isRight){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'I',
          isFullCorrect: isRight,
          earnedPt: earnedPt,
          maxPt: maxPt,
          userChoice: userChoice || 'Chưa chọn',
          correctKey: q.correctKey,
          question: q
        });
      } else if(q.part === 'II'){
        var maxPt = 1.0;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var userStmts = answers[q.id] || {};
        var correctStatements = 0;
        (q.statements || []).forEach(function(st){
          if(userStmts[st.key] !== undefined && userStmts[st.key] === st.isTrue){
            correctStatements++;
          }
        });
        var earnedPt = 0;
        if(correctStatements === 1) earnedPt = 0.1;
        else if(correctStatements === 2) earnedPt = 0.25;
        else if(correctStatements === 3) earnedPt = 0.5;
        else if(correctStatements === 4) earnedPt = 1.0;

        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        var isFull = (correctStatements === (q.statements || []).length);
        if(isFull){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'II',
          isFullCorrect: isFull,
          earnedPt: earnedPt,
          maxPt: maxPt,
          correctSubCount: correctStatements,
          userStmts: userStmts,
          question: q
        });
      } else if(q.part === 'III'){
        var maxPt = 0.25;
        totalMaxScore += maxPt;
        tStats.maxScore += maxPt;
        var rawVal = answers[q.id];
        var isRight = false;
        if(rawVal !== undefined && rawVal !== '' && !isNaN(Number(rawVal))){
          var num = Number(rawVal);
          var tol = q.tolerance || 0.05;
          isRight = Math.abs(num - q.correctAnswer) <= tol;
        }
        var earnedPt = isRight ? maxPt : 0;
        totalEarnedScore += earnedPt;
        tStats.earnedScore += earnedPt;
        if(isRight){ correctCount++; tStats.correct++; }

        perQuestionResults.push({
          qId: q.id,
          idx: idx + 1,
          part: 'III',
          isFullCorrect: isRight,
          earnedPt: earnedPt,
          maxPt: maxPt,
          userAnswer: rawVal,
          correctAnswer: q.correctAnswer,
          unit: q.unit || '',
          question: q
        });
      }
    });

    // Quy đổi ra thang điểm 10 chuẩn
    var scaledScore10 = totalMaxScore > 0 ? (totalEarnedScore / totalMaxScore) * 10 : 0;
    scaledScore10 = Math.round(scaledScore10 * 100) / 100;

    return {
      totalQuestions: questions.length,
      correctCount: correctCount,
      totalEarnedScore: Math.round(totalEarnedScore * 100) / 100,
      totalMaxScore: Math.round(totalMaxScore * 100) / 100,
      scaledScore10: scaledScore10,
      perQuestionResults: perQuestionResults,
      topicStats: topicStats
    };
  }

  // ============================================================
  // Bản đồ kiến thức "nano" (mô hình Squirrel AI) — dựa trên danh mục
  // chuẩn trong nano-map.js (window.OPC_NANO), nếu file đó đã được nạp.
  // Mỗi câu trong QUESTION_BANK được gắn 1 nano-point cụ thể (chọn theo
  // "Bài"/subtopic sẵn có + mức độ M1-M4 của câu, không cần sửa lại từng
  // câu thủ công). Mastery của từng nano-point hiện là số liệu minh hoạ
  // (suy ra từ defaultMastery của cả chuyên đề + dao động theo id) —
  // CHỖ CẮM DỮ LIỆU THẬT sau này: thay hàm getNanoMastery() bằng số liệu
  // tổng hợp từ lịch sử làm bài thật của từng học sinh trên Firestore.
  // ============================================================
  function hashStr(s){
    var h = 0;
    s = String(s || '');
    for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return h;
  }

  function getNanoMastery(nanoId, baseMastery){
    var base = (baseMastery != null) ? baseMastery : 60;
    var variance = (hashStr(nanoId) % 30) - 15; // dao động -15..+14 quanh mức trung bình chuyên đề
    return Math.max(5, Math.min(99, base + variance));
  }

  // Gắn nanoId cho từng câu mẫu trong QUESTION_BANK dựa trên subtopic đã có
  // sẵn (subtopic hiện dùng đúng tên "Bài" trong danh mục nano-map.js).
  // Câu mức M1/M2 gắn vào nano "khái niệm/công thức" (đầu danh sách), câu
  // mức M3/M4 gắn vào nano "bài toán tổng hợp" (cuối danh sách).
  (function assignNanoToSeedQuestions(){
    if(!window.OPC_NANO) return;
    QUESTION_BANK.forEach(function(q){
      if(q.nanoId) return;
      var bai = window.OPC_NANO.findBaiByText(q.subtopic, q.topicKey);
      if(!bai) return;
      var nanos = window.OPC_NANO.getNanoByBai(bai.key);
      if(!nanos.length) return;
      var pick = (q.level === 'M3' || q.level === 'M4') ? nanos[nanos.length - 1] : nanos[0];
      q.baiKey = bai.key;
      q.nanoId = pick.id;
    });
  })();

  function buildKnowledgeMap(studentMasteryByTopic){
    if(!window.OPC_NANO) return [];
    return Object.keys(CHU_DE_MAP).map(function(topicKey){
      var topic = CHU_DE_MAP[topicKey];
      var base = (studentMasteryByTopic && studentMasteryByTopic[topicKey] != null) ? studentMasteryByTopic[topicKey] : topic.defaultMastery;
      var bais = window.OPC_NANO.getBaiByChuDe(topicKey).map(function(b){
        var nanos = window.OPC_NANO.getNanoByBai(b.key).map(function(n){
          return { id: n.id, name: n.name, mastery: getNanoMastery(n.id, base) };
        });
        var avg = nanos.length ? Math.round(nanos.reduce(function(s, n){ return s + n.mastery; }, 0) / nanos.length) : base;
        return { key: b.key, name: b.name, mastery: avg, nanos: nanos };
      });
      return { topicKey: topicKey, topicName: topic.name, icon: topic.icon, mastery: base, bais: bais };
    });
  }

  function getWeakestNanoPoints(map, n){
    var all = [];
    map.forEach(function(t){
      t.bais.forEach(function(b){
        b.nanos.forEach(function(nn){
          all.push(Object.assign({}, nn, { topicName: t.topicName, topicKey: t.topicKey, baiName: b.name }));
        });
      });
    });
    all.sort(function(a, b){ return a.mastery - b.mastery; });
    return all.slice(0, n || 5);
  }

  // CHỖ CẮM DỮ LIỆU THẬT: gọi hàm này (từ opc-live-data.js sau khi nạp xong
  // ngân hàng đề thật từ Firestore) để THAY TOÀN BỘ câu hỏi minh hoạ bằng
  // câu hỏi thật. Giữ nguyên tham chiếu mảng QUESTION_BANK (dùng
  // splice/push thay vì gán lại biến) để các hàm closure phía dưới
  // (getQuestionsByTopic, createFocusedDrill...) vẫn thấy được dữ liệu mới.
  function replaceQuestionBank(list){
    if(!list || !list.length) return false;
    QUESTION_BANK.length = 0;
    Array.prototype.push.apply(QUESTION_BANK, list);
    return true;
  }

  // Khởi tạo và xuất đối tượng sang window
  window.PrepScholarEngine = {
    CHU_DE_MAP: CHU_DE_MAP,
    QUESTION_BANK: QUESTION_BANK,
    replaceQuestionBank: replaceQuestionBank,
    scoreExam: scoreExam,
    getQuestionsByTopic: function(topicKey){
      return QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
    },
    createFocusedDrill: function(topicKey, count){
      var pool = QUESTION_BANK.filter(function(q){ return q.topicKey === topicKey; });
      if(!pool.length) pool = QUESTION_BANK;
      count = Math.min(count || 5, pool.length);
      return pool.slice(0, count);
    },
    createDiagnosticExam: function(){
      // Lấy đều 3 câu từ mỗi một trong 4 chuyên đề (12 câu đủ 3 phần)
      var res = [];
      Object.keys(CHU_DE_MAP).forEach(function(k){
        var list = QUESTION_BANK.filter(function(q){ return q.topicKey === k; });
        res = res.concat(list.slice(0, 3));
      });
      return res;
    },
    // Bản đồ kiến thức mức nano — truyền vào mastery theo chuyên đề của 1 học
    // sinh cụ thể (vd. student.mastery) để làm mốc tính; bỏ trống thì dùng
    // defaultMastery chung của từng chuyên đề.
    getKnowledgeMap: function(studentMasteryByTopic){
      return buildKnowledgeMap(studentMasteryByTopic);
    },
    getWeakestNanoPoints: function(studentMasteryByTopic, n){
      return getWeakestNanoPoints(buildKnowledgeMap(studentMasteryByTopic), n);
    }
  };

})(window);
