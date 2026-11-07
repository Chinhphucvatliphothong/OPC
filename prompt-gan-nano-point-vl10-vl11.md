# Prompt gắn tag nano-point – Vật lí 10 và Vật lí 11 (SGK Kết nối tri thức)

Bản đồng bộ với `nano-map.js` ngày 07/11/2026: Vật lí 10 có 74 nano-point (md-, cd-, bd-, dlh-), Vật lí 11 có 178 nano-point (k11-, s11-, dt11-, dd11-).
Định dạng thẻ và mức độ M1–M4 giống hệt prompt Vật lí 12 (`prompt-gan-nano-point-moi.md`).

Cách dùng: copy nguyên khối trong ba dấu ``` bên dưới, dán vào Claude, thay phần D ở cuối bằng câu mẫu và đề cần chuyển.

```
Chuyển đề Vật lí 10/11 dưới đây sang LaTeX (gói ex_test) và gắn tag nano-point.

ĐỊNH DẠNG BẮT BUỘC cho mỗi câu:
%Câu <số>
% [<M1|M2|M3|M4>][<tên chủ đề>][<tên bài>]
% @nano: <mã nano chính>[, <mã phụ>[, <mã phụ>]]
\begin{ex}
  ...
\end{ex}

Ví dụ:
%Câu 3
% [M3][Động học (VL10)][Bài 2: Chuyển động thẳng biến đổi đều]
% @nano: bd-2.4, bd-2.2
%Câu 7
% [M2][Sóng (VL11)][Bài 12: Giao thoa sóng]
% @nano: s11-5.7

======================================================================
A. QUY TẮC CHUNG
======================================================================
1. Ngoặc 2 (tên chủ đề) chỉ được là MỘT trong 7 chuỗi sau, chép y hệt (kể cả phần "(VL10)"/"(VL11)"):
   Vật lí 10: Mở đầu (VL10) | Động học (VL10) | Động lực học (VL10)
   Vật lí 11: Dao động (VL11) | Sóng (VL11) | Điện trường (VL11) | Dòng điện, mạch điện (VL11)
2. Ngoặc 3 (tên bài) chép NGUYÊN VĂN tên bài ở mục C, kể cả "Bài n:" và dấu câu.
   Dấu gạch ngang trong tên bài dùng "–" như ở mục C.
   Vật lí 10 đánh số bài lại trong từng chủ đề (Bài 1 của Mô tả chuyển động khác Bài 1 của
   Chuyển động biến đổi) — vì vậy luôn chép ĐỦ cả tên bài, không chỉ "Bài 1".
3. Mã nano chỉ được chọn trong mục C. Mã, bài và chủ đề phải khớp nhau:
   md-… đi với Mở đầu (VL10); cd-… và bd-… đi với Động học (VL10); dlh-… với Động lực học (VL10);
   k11-… với Dao động (VL11); s11-… với Sóng (VL11); dt11-… với Điện trường (VL11);
   dd11-… với Dòng điện, mạch điện (VL11).
4. Chọn theo KIẾN THỨC câu hỏi kiểm tra, không theo từ khoá xuất hiện.
5. Nano có chữ "Bài tập", "Bài toán", "Đồ thị", "Thực hành" chỉ dùng khi câu đúng dạng đó; câu thuần lí thuyết
   dùng nano khái niệm/lí thuyết của bài tương ứng (vd. k11-4.3 chứ không phải k11-4.6 nếu chỉ hỏi
   công thức chu kì con lắc lò xo).
6. Câu dùng nhiều kiến thức (thường là đề thi thử của trường/sở): ghi tối đa 3 mã,
   mã chính (kiến thức quyết định đúng/sai) đứng đầu; các mã có thể thuộc các bài
   hoặc chủ đề khác nhau (kể cả khác khối, vd. dlh-3.3 với bd-2.1). Ngoặc 2 và ngoặc 3 lấy theo mã chính.
7. Mức độ: M1 nhận biết, M2 thông hiểu, M3 vận dụng, M4 vận dụng cao (xem mục B).
8. Giữ nguyên nội dung, số liệu, đáp án gốc. Không tự sửa đề.
   Có lời giải thì đưa vào \loigiai{}, không có thì để trống, không tự bịa.
   Dùng đúng macro như câu mẫu tôi dán ở cuối.
9. Sau khi xong, lập bảng: Câu | Mức | Mã nano | Lí do chọn (1 dòng),
   và đánh dấu (?) những câu phân vân giữa 2 mã hoặc giữa 2 mức để tôi tự quyết.

======================================================================
B. MỨC ĐỘ (giống Vật lí 12)
======================================================================
M1 – Nhận biết: nhắc lại định nghĩa, khái niệm, đơn vị, công thức, hiện tượng; đọc trực tiếp 1 giá trị.
     Vd: đơn vị của gia tốc; phát biểu định luật I Newton; sóng ngang là gì; kí hiệu tụ điện.
M2 – Thông hiểu: giải thích, so sánh, phân biệt; thay số trực tiếp vào 1 công thức (1 bước);
     đọc đồ thị đơn giản. Vd: a = F/m tìm a; λ = v/f; I = Δq/Δt; phân biệt cặp lực – phản lực với hai lực cân bằng.
M3 – Vận dụng: phối hợp 2–3 công thức hoặc 2 bước suy luận, đổi đơn vị, lập phương trình, đọc đồ thị
     có tính toán. Vd: vật trên mặt phẳng nghiêng có ma sát; số cực đại giao thoa trên đoạn;
     định luật Ohm toàn mạch; quãng đường trong giây thứ n.
M4 – Vận dụng cao: bài nhiều giai đoạn/nhiều vật, cực trị, biện luận, hệ phương trình, đồ thị phức tạp,
     bối cảnh thực tế mới. Vd: cơ hệ nhiều vật có ma sát; cực trị công suất; giao thoa nhiều bức xạ;
     mạch tụ nâng cao; hai dao động gặp nhau.
Gợi ý nhanh: nano "lí thuyết/khái niệm" thường ở M1–M2; nano "Bài tập"/"Bài toán"/"Đồ thị" thường ở M2–M4
— nhưng luôn xếp mức theo ĐỘ KHÓ THẬT của câu, không theo tên nano.
Câu đúng/sai (a)–d)): mỗi câu ex chỉ ghi 1 mức — lấy mức của ý khó nhất.

======================================================================
C. DANH MỤC BÀI VÀ NANO-POINT
======================================================================

---------------- C1. Mở đầu (VL10) ----------------
Bài 1: Khái quát về môn Vật lí
   md-1.1 Đối tượng nghiên cứu và mục tiêu của Vật lí
   md-1.2 Quá trình phát triển của Vật lí
   md-1.3 Vật lí với cuộc sống, khoa học, kĩ thuật và công nghệ
   md-1.4 Phương pháp nghiên cứu Vật lí (phương pháp thực nghiệm, phương pháp lí thuyết)
Bài 2: Vấn đề an toàn trong Vật lí
   md-2.1 Vấn đề an toàn trong nghiên cứu và học tập Vật lí
   md-2.2 Các quy tắc an toàn trong phòng thực hành Vật lí
   md-2.3 Biển báo (cấm, cảnh báo, chỉ dẫn) và cách xử lí sự cố
Bài 3: Đơn vị và sai số trong Vật lí
   md-3.1 Đơn vị, thứ nguyên, đổi đơn vị, hệ SI và tiền tố
   md-3.2 Sai số phép đo (tuyệt đối, tương đối, sai số dụng cụ, sai số ngẫu nhiên)
   md-3.3 Thực hành: tính sai số trong phép đo, ghi kết quả đo

---------------- C2. Động học (VL10) ----------------
(Gồm 2 chủ đề của danh mục: Mô tả chuyển động – mã cd-…, Chuyển động biến đổi – mã bd-…)
[Mô tả chuyển động]
Bài 1: Chuyển động thẳng
   cd-1.1 Chất điểm, hệ quy chiếu, mốc thời gian
   cd-1.2 Phương trình toạ độ – thời gian của chuyển động thẳng
   cd-1.3 Phân biệt dạng chuyển động thẳng và chuyển động cong
Bài 2: Độ dịch chuyển và quãng đường đi được
   cd-2.1 Phân biệt quãng đường và độ dịch chuyển
   cd-2.2 Tính độ dịch chuyển, quãng đường trên một trục
   cd-2.3 Độ dịch chuyển tổng hợp (cùng phương)
Bài 3: Tốc độ và vận tốc
   cd-3.1 Tốc độ, tốc độ trung bình, tốc độ tức thời
   cd-3.2 Vận tốc, vận tốc trung bình
   cd-3.3 Định thời điểm và vị trí gặp nhau của các chuyển động
Bài 4: Đồ thị độ dịch chuyển – thời gian
   cd-4.1 Đọc đồ thị d – t (vận tốc, vị trí, chiều chuyển động)
   cd-4.2 Vẽ đồ thị d – t và lập phương trình từ đồ thị
   cd-4.3 Đồ thị d – t của hai vật, điểm gặp nhau
Bài 5: Chuyển động tổng hợp
   cd-5.1 Công thức cộng vận tốc, hệ quy chiếu đứng yên và chuyển động
   cd-5.2 Chuyển động tổng hợp của thuyền, ca nô trên sông
   cd-5.3 Chuyển động tổng hợp hai phương vuông góc, hợp góc bất kì
Bài 6: Thực hành đo tốc độ của vật chuyển động thẳng
   cd-6.1 Phương án, dụng cụ, cách bố trí thí nghiệm
   cd-6.2 Xử lí số liệu, tính tốc độ và sai số
   cd-6.3 Nhận xét nguyên nhân sai số và cách khắc phục
[Chuyển động biến đổi]
Bài 1: Chuyển động biến đổi – Gia tốc
   bd-1.1 Khái niệm gia tốc, đơn vị, chiều của gia tốc
   bd-1.2 Tính gia tốc trung bình từ bảng số liệu
   bd-1.3 Nhận biết chuyển động nhanh dần, chậm dần (dấu của v và a)
Bài 2: Chuyển động thẳng biến đổi đều
   bd-2.1 Công thức vận tốc, quãng đường, phương trình toạ độ (v0, a, t)
   bd-2.2 Công thức độc lập thời gian v² – v0² = 2as
   bd-2.3 Quãng đường đi được trong giây thứ n, trong n giây cuối
   bd-2.4 Bài toán phanh, dừng lại, đổi chiều chuyển động
   bd-2.5 Đồ thị vận tốc – thời gian (đọc đồ thị, tính gia tốc, quãng đường từ diện tích)
   bd-2.6 Bài toán gặp nhau của hai vật (chuyển động thẳng biến đổi đều)
Bài 3: Sự rơi tự do
   bd-3.1 Khái niệm rơi tự do, đặc điểm (phương, chiều, g)
   bd-3.2 Công thức rơi tự do: v, h, thời gian rơi
   bd-3.3 Quãng đường rơi trong giây cuối, trong n giây cuối
   bd-3.4 Rơi tự do nhiều vật, thả vật tại các thời điểm khác nhau
Bài 4: Thực hành đo gia tốc rơi tự do và vật ném thẳng đứng
   bd-4.1 Thực hành đo g: dụng cụ, phương án, xử lí số liệu
   bd-4.2 Vật ném lên thẳng đứng (độ cao cực đại, thời gian lên, vận tốc chạm đất)
   bd-4.3 Ném thẳng đứng hai vật, hai vật gặp nhau
Bài 5: Chuyển động ném
   bd-5.1 Chuyển động ném ngang (tầm xa, thời gian, vận tốc chạm đất)
   bd-5.2 Chuyển động ném xiên (độ cao cực đại, tầm xa, góc ném)
   bd-5.3 Phân tích chuyển động ném thành hai chuyển động thành phần, lí thuyết quỹ đạo

---------------- C3. Động lực học (VL10) ----------------
Bài 1: Tổng hợp lực và cân bằng lực
   dlh-1.1 Tổng hợp hai lực đồng quy (quy tắc hình bình hành, giá trị F theo góc α)
   dlh-1.2 Phân tích lực thành hai thành phần vuông góc
   dlh-1.3 Điều kiện cân bằng của chất điểm chịu tác dụng của 2 và 3 lực
   dlh-1.4 Bài toán cân bằng lực với dây, vật treo
Bài 2: Định luật I Newton
   dlh-2.1 Phát biểu định luật I, quán tính
   dlh-2.2 Giải thích hiện tượng quán tính trong đời sống
   dlh-2.3 Vật chuyển động thẳng đều, cân bằng lực
Bài 3: Định luật II Newton
   dlh-3.1 Liên hệ lực, khối lượng, gia tốc (lí thuyết)
   dlh-3.2 Bài toán a = F/m: tìm a, F, m
   dlh-3.3 Kết hợp định luật II với động học (v, s, t)
   dlh-3.4 Lực kéo, lực cản tổng hợp trên mặt ngang
Bài 4: Định luật III Newton
   dlh-4.1 Phát biểu, đặc điểm cặp lực – phản lực
   dlh-4.2 Phân biệt cặp lực – phản lực với hai lực cân bằng
   dlh-4.3 Bài toán va chạm, tương tác hai vật (áp dụng định luật III)
Bài 5: Trọng lực và lực căng
   dlh-5.1 Trọng lực, trọng lượng, gia tốc rơi tự do ở các thiên thể
   dlh-5.2 Lực căng dây (dây nhẹ, ròng rọc cố định)
   dlh-5.3 Vật treo trên hai dây, góc treo, dây chịu lực tối đa
   dlh-5.4 Hệ ròng rọc, hai vật nối qua ròng rọc
Bài 6: Lực ma sát
   dlh-6.1 Lí thuyết ma sát nghỉ, ma sát trượt, ma sát lăn
   dlh-6.2 Vật chuyển động trên mặt phẳng ngang có ma sát
   dlh-6.3 Kéo vật bằng lực theo phương xiên
   dlh-6.4 Vật trên mặt phẳng nghiêng có ma sát
   dlh-6.5 Cơ hệ nhiều vật (hai vật nối dây, ma sát)
Bài 7: Lực cản và lực nâng
   dlh-7.1 Lực cản của môi trường (không khí, chất lỏng), gia tốc khi có lực cản
   dlh-7.2 Lực nâng của chất lỏng, lực đẩy Archimedes (công thức, điều kiện nổi, chìm)
   dlh-7.3 Vật treo lực kế nhúng chìm trong chất lỏng
   dlh-7.4 Vật nổi cân bằng trong chất lỏng, độ cao phần nổi, phần chìm

---------------- C4. Dao động (VL11) ----------------
Bài 1: Dao động điều hoà
   k11-1.1 Khái niệm dao động cơ, dao động tuần hoàn
   k11-1.2 Dao động tự do (dao động riêng)
   k11-1.3 Khái niệm và đồ thị li độ – thời gian của dao động điều hoà
   k11-1.4 Phương trình li độ x = Acos(ωt + φ): ý nghĩa A, ω, φ, pha
   k11-1.5 Độ dịch chuyển và li độ của vật dao động
   k11-1.6 Liên hệ dao động điều hoà – chuyển động tròn đều
Bài 2: Mô tả dao động điều hoà
   k11-2.1 Biên độ dao động, chiều dài quỹ đạo
   k11-2.2 Chu kì dao động
   k11-2.3 Tần số dao động
   k11-2.4 Tần số góc, liên hệ ω – T – f
   k11-2.5 Pha dao động, pha ban đầu
   k11-2.6 Độ lệch pha hai dao động cùng chu kì (cùng, ngược, vuông pha)
   k11-2.7 Bài tập đại lượng đặc trưng, viết phương trình dao động
   k11-2.8 Bài tập thời gian (vòng tròn lượng giác, số lần qua vị trí)
   k11-2.9 Bài tập quãng đường, tốc độ trung bình
   k11-2.10 Bài tập hai dao động: độ lệch pha, khoảng cách, gặp nhau
Bài 3: Vận tốc, gia tốc trong dao động điều hoà
   k11-3.1 Vận tốc: phương trình, sớm pha π/2, hướng, giá trị cực đại
   k11-3.2 Đồ thị vận tốc, liên hệ v – x (đường elip)
   k11-3.3 Gia tốc: phương trình, ngược pha li độ, luôn hướng về VTCB
   k11-3.4 Đồ thị gia tốc, liên hệ a – x (đoạn thẳng)
   k11-3.5 Lực kéo về (hợp lực tác dụng lên vật DĐĐH)
   k11-3.6 Bài tập li độ, vận tốc, gia tốc, hệ thức độc lập thời gian
   k11-3.7 Bài tập đồ thị x, v, a theo thời gian
Bài 4: Bài tập về dao động điều hoà
   k11-4.1 Tần số riêng của hệ dao động tự do (chỉ phụ thuộc đặc tính hệ)
   k11-4.2 Con lắc lò xo: cấu tạo, lực đàn hồi, gia tốc a = −(k/m)x
   k11-4.3 Chu kì, tần số, tần số góc con lắc lò xo (lí thuyết)
   k11-4.4 Con lắc đơn: cấu tạo, điều kiện DĐĐH, li độ dài – li độ góc, lực kéo về
   k11-4.5 Chu kì, tần số con lắc đơn; ứng dụng đo gia tốc rơi tự do (lí thuyết)
   k11-4.6 Bài tập con lắc lò xo: T, f, ω, thay đổi khối lượng
   k11-4.7 Bài tập con lắc lò xo: chiều dài lò xo, thời gian nén – dãn
   k11-4.8 Bài tập con lắc lò xo: lực kéo về, lực đàn hồi (kể cả đồ thị lực)
   k11-4.9 Bài tập con lắc đơn biên độ lớn: vận tốc, lực căng, gia tốc
   k11-4.10 Bài tập con lắc đơn biên độ nhỏ: T, f, li độ, đo g
Bài 5: Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà
   k11-5.1 Động năng: biểu thức, biến thiên theo thời gian (chu kì T/2)
   k11-5.2 Thế năng: biểu thức, biến thiên theo thời gian (chu kì T/2)
   k11-5.3 Đồ thị động năng, thế năng theo li độ và thời gian
   k11-5.4 Chuyển hoá và bảo toàn cơ năng trong DĐĐH
   k11-5.5 Cơ năng con lắc lò xo W = ½kA²
   k11-5.6 Cơ năng con lắc đơn W = mgℓ(1 − cosα0)
Bài 6: Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng
   k11-6.1 Dao động tắt dần: hiện tượng, nguyên nhân, đặc điểm
   k11-6.2 Ứng dụng dao động tắt dần (giảm xóc, cửa tự động)
   k11-6.3 Dao động duy trì
   k11-6.4 Dao động cưỡng bức: khái niệm, tần số, biên độ
   k11-6.5 Hiện tượng cộng hưởng: định nghĩa, điều kiện, giải thích
   k11-6.6 Lợi ích và tác hại của cộng hưởng
   k11-6.7 Bài tập dao động tắt dần (phần trăm năng lượng, biên độ giảm)
   k11-6.8 Bài tập dao động cưỡng bức, cộng hưởng (tần số, đồ thị cộng hưởng)
Bài 7: Bài tập về sự chuyển hoá năng lượng trong dao động điều hoà
   k11-7.1 Bài tập động năng, thế năng, cơ năng (tỉ số Wđ/Wt, vị trí Wđ = nWt)
   k11-7.2 Bài tập biến đổi Wđ, Wt theo thời gian (thời gian Wđ = Wt…)
   k11-7.3 Bài tập đồ thị năng lượng

---------------- C5. Sóng (VL11) ----------------
Bài 8: Mô tả sóng
   s11-1.1 Khái niệm sóng cơ, môi trường truyền sóng, phần tử môi trường dao động tại chỗ
   s11-1.2 Các đại lượng đặc trưng: biên độ, chu kì, tần số, bước sóng, tốc độ truyền sóng
   s11-1.3 Liên hệ v = λf = λ/T
   s11-1.4 Đồ thị li độ – khoảng cách (hình dạng sóng) và li độ – thời gian
   s11-1.5 Năng lượng sóng, cường độ sóng I = P/S
   s11-1.6 Độ lệch pha giữa hai điểm trên phương truyền sóng Δφ = 2πd/λ
   s11-1.7 Bài tập đại lượng đặc trưng (λ, v, f, T, khoảng cách đỉnh sóng)
   s11-1.8 Bài tập đồ thị sóng (đọc λ, A; chiều truyền sóng, chiều chuyển động phần tử)
   s11-1.9 Bài tập độ lệch pha, phương trình sóng, điểm cùng pha – ngược pha – vuông pha
   s11-1.10 Bài tập cường độ sóng, năng lượng sóng
Bài 9: Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ
   s11-2.1 Sóng ngang: định nghĩa, môi trường truyền
   s11-2.2 Sóng dọc: định nghĩa, môi trường truyền
   s11-2.3 Sự truyền năng lượng của sóng cơ
   s11-2.4 Sóng âm: bản chất, môi trường truyền, tốc độ âm trong các môi trường
   s11-2.5 Âm nghe được, hạ âm, siêu âm và ứng dụng
   s11-2.6 Bài tập sóng âm (tốc độ âm, tiếng vang, đo độ sâu bằng siêu âm)
Bài 10: Thực hành: Đo tần số của sóng âm
   s11-3.1 Dao động kí điện tử: cấu tạo, cách đọc đồ thị trên màn hình
   s11-3.2 Thực hành đo tần số sóng âm bằng dao động kí
Bài 11: Sóng điện từ
   s11-4.1 Khái niệm sóng điện từ, tính chất (sóng ngang, truyền được trong chân không, c = 3.10^8 m/s)
   s11-4.2 Thang sóng điện từ: vô tuyến, vi sóng, hồng ngoại, ánh sáng nhìn thấy, tử ngoại, tia X, tia gamma
   s11-4.3 Ứng dụng các vùng sóng điện từ trong đời sống, kĩ thuật
   s11-4.4 Bài tập λ = c/f, xác định vùng sóng điện từ
Bài 12: Giao thoa sóng
   s11-5.1 Hiện tượng giao thoa, nguồn kết hợp, điều kiện giao thoa
   s11-5.2 Giao thoa sóng mặt nước: cực đại, cực tiểu, điều kiện hiệu đường đi
   s11-5.3 Giao thoa ánh sáng (thí nghiệm Young): vân sáng, vân tối
   s11-5.4 Khoảng vân i = λD/a, vị trí vân sáng, vân tối
   s11-5.5 Bài tập giao thoa sóng mặt nước: tính chất điểm, số cực đại – cực tiểu trên đoạn
   s11-5.6 Bài tập giao thoa sóng mặt nước nâng cao (cực trị trên đường tròn, hình vuông; điểm cùng pha – ngược pha nguồn)
   s11-5.7 Bài tập giao thoa ánh sáng: khoảng vân, vị trí vân, tính λ
   s11-5.8 Bài tập giao thoa ánh sáng: số vân trên vùng giao thoa, thay đổi a, D, λ
   s11-5.9 Bài tập giao thoa ánh sáng nhiều bức xạ, ánh sáng trắng
Bài 13: Sóng dừng
   s11-6.1 Sóng phản xạ (đầu cố định, đầu tự do), sự tạo thành sóng dừng
   s11-6.2 Nút sóng, bụng sóng; khoảng cách giữa các nút, bụng
   s11-6.3 Điều kiện sóng dừng dây hai đầu cố định ℓ = kλ/2
   s11-6.4 Điều kiện sóng dừng một đầu cố định, một đầu tự do ℓ = (2k + 1)λ/4
   s11-6.5 Sóng dừng trong cột không khí, ứng dụng trong nhạc cụ
   s11-6.6 Bài tập sóng dừng: số nút, số bụng, tần số, tốc độ truyền sóng
   s11-6.7 Bài tập sóng dừng nâng cao: biên độ điểm, tần số liên tiếp, thời gian dây duỗi thẳng
Bài 15: Thực hành: Đo tốc độ truyền âm
   s11-7.1 Thực hành đo tốc độ truyền âm: dụng cụ, phương án (cộng hưởng cột khí)
   s11-7.2 Xử lí số liệu, sai số trong thực hành đo tốc độ truyền âm

---------------- C6. Điện trường (VL11) ----------------
Bài 16: Lực tương tác giữa các điện tích
   dt11-1.1 Hai loại điện tích, điện tích điểm, vật nhiễm điện – vật trung hoà
   dt11-1.2 Sự nhiễm điện do cọ xát, tiếp xúc, hưởng ứng
   dt11-1.3 Tương tác giữa các điện tích (cùng dấu đẩy, trái dấu hút)
   dt11-1.4 Thuyết electron, định luật bảo toàn điện tích
   dt11-1.5 Đơn vị điện tích, điện tích nguyên tố, điện tích electron – proton
   dt11-1.6 Định luật Coulomb trong chân không, nguyên lí chồng chất lực
   dt11-1.7 Lực tương tác trong điện môi, hằng số điện môi
   dt11-1.8 Bài tập số electron thừa – thiếu, chia điện tích khi tiếp xúc
   dt11-1.9 Bài tập lực Coulomb giữa hai điện tích (chân không, điện môi)
   dt11-1.10 Bài tập lực tổng hợp tác dụng lên một điện tích
   dt11-1.11 Bài tập cân bằng của một điện tích, hệ ba điện tích
   dt11-1.12 Bài tập con lắc tích điện, quả cầu treo bằng dây
Bài 17: Khái niệm điện trường
   dt11-2.1 Khái niệm điện trường, tính chất cơ bản của điện trường
   dt11-2.2 Cường độ điện trường: định nghĩa, F = qE, chiều của E và F
   dt11-2.3 Điện trường của điện tích điểm E = k|Q|/(εr²)
   dt11-2.4 Đơn vị cường độ điện trường (V/m, N/C)
   dt11-2.5 Nguyên lí chồng chất điện trường
   dt11-2.6 Điện phổ, đường sức điện và tính chất
   dt11-2.7 Bài tập cường độ điện trường của điện tích điểm, lực điện tác dụng lên điện tích
   dt11-2.8 Bài tập điện trường tổng hợp của hệ điện tích
   dt11-2.9 Bài tập điểm có điện trường tổng hợp bằng không
   dt11-2.10 Bài tập điện tích cân bằng trong điện trường (dây treo, giọt dầu)
Bài 18: Điện trường đều
   dt11-3.1 Khái niệm điện trường đều, đường sức điện trường đều
   dt11-3.2 Điện trường đều giữa hai bản phẳng E = U/d
   dt11-3.3 Chuyển động của điện tích có vận tốc đầu song song đường sức
   dt11-3.4 Chuyển động của điện tích có vận tốc đầu vuông góc đường sức (quỹ đạo parabol)
   dt11-3.5 Ứng dụng: ống phóng điện tử, máy gia tốc, máy in phun
   dt11-3.6 Bài tập E = U/d, lực điện trong điện trường đều
   dt11-3.7 Bài tập chuyển động thẳng của điện tích dọc đường sức (tăng tốc, hãm)
   dt11-3.8 Bài tập chuyển động ném ngang của điện tích (thời gian, độ lệch, vận tốc ra)
Bài 19: Thế năng điện
   dt11-4.1 Công của lực điện A = qEd, không phụ thuộc hình dạng đường đi
   dt11-4.2 Thế năng điện, A_MN = W_M − W_N
   dt11-4.3 Bài tập công của lực điện trong điện trường đều (đường gấp khúc, tam giác)
   dt11-4.4 Bài tập thế năng điện, định lí động năng cho điện tích
Bài 20: Điện thế
   dt11-5.1 Điện thế tại một điểm V = A_M∞/q = W_M/q
   dt11-5.2 Hiệu điện thế U_MN = V_M − V_N = A_MN/q, đơn vị vôn
   dt11-5.3 Liên hệ giữa cường độ điện trường và hiệu điện thế trong điện trường đều U = Ed
   dt11-5.4 Bài tập điện thế, hiệu điện thế, công của lực điện
   dt11-5.5 Bài tập liên hệ E – U, điện thế các bản, hình học trong điện trường đều
   dt11-5.6 Bài tập chuyển động hạt mang điện qua hiệu điện thế (gia tốc electron, giọt dầu lơ lửng)
Bài 21: Tụ điện
   dt11-6.1 Điện môi trong điện trường, sự phân cực điện môi
   dt11-6.2 Tụ điện: cấu tạo, kí hiệu, cách tích điện, điện tích của tụ
   dt11-6.3 Điện dung, đơn vị, hiệu điện thế giới hạn, tụ phẳng C = εS/(4πkd)
   dt11-6.4 Ghép tụ điện nối tiếp, song song
   dt11-6.5 Bài tập điện dung, điện tích, hiệu điện thế giới hạn của tụ
   dt11-6.6 Bài tập tụ ngắt khỏi nguồn / vẫn nối nguồn khi thay đổi d, S, ε
   dt11-6.7 Bài tập ghép tụ điện
   dt11-6.8 Bài tập mạch tụ nâng cao (nối các tấm kim loại, mạch có nhiều nguồn)
Bài 21 (tiếp): Năng lượng của tụ điện. Ứng dụng của tụ điện
   dt11-7.1 Năng lượng của tụ điện W = QU/2 = CU²/2 = Q²/(2C)
   dt11-7.2 Ứng dụng của tụ điện trong đời sống, kĩ thuật
   dt11-7.3 Bài tập năng lượng tụ điện, công làm thay đổi năng lượng tụ
   dt11-7.4 Bài tập ứng dụng tụ điện (flash, máy hàn, công suất phóng điện)

---------------- C7. Dòng điện, mạch điện (VL11) ----------------
Bài 22: Cường độ dòng điện
   dd11-1.1 Khái niệm dòng điện, chiều quy ước, dòng điện không đổi
   dd11-1.2 Hạt mang điện trong kim loại, chất điện phân
   dd11-1.3 Cường độ dòng điện I = Δq/Δt, đơn vị, ampe kế, các tác dụng của dòng điện
   dd11-1.4 Tốc độ trôi của hạt mang điện, I = Snve
   dd11-1.5 Bài tập cường độ dòng điện, điện lượng, số electron
   dd11-1.6 Bài tập tốc độ trôi, mật độ hạt tải điện
Bài 23: Điện trở. Định luật Ohm
   dd11-2.1 Khái niệm điện trở, đơn vị ôm
   dd11-2.2 Điện trở dây dẫn R = ρℓ/S, điện trở suất, cách đọc vòng màu
   dd11-2.3 Định luật Ohm cho đoạn mạch chỉ có điện trở, biến trở
   dd11-2.4 Đường đặc trưng vôn – ampe
   dd11-2.5 Nguyên nhân gây ra điện trở của kim loại
   dd11-2.6 Ảnh hưởng của nhiệt độ: đèn sợi đốt, điện trở nhiệt NTC – PTC, siêu dẫn
   dd11-2.7 Sự dẫn điện trong hệ thần kinh
   dd11-2.8 Bài tập R = ρℓ/S, thay đổi kích thước dây dẫn
   dd11-2.9 Bài tập định luật Ohm, đồ thị I – U
   dd11-2.10 Bài tập đoạn mạch điện trở nối tiếp, song song
   dd11-2.11 Bài tập mạch hỗn hợp, mạch cầu, mạch có vôn kế – ampe kế
Bài 24: Nguồn điện
   dd11-3.1 Điều kiện có dòng điện, nguồn điện, lực lạ
   dd11-3.2 Suất điện động của nguồn điện E = A/q
   dd11-3.3 Điện trở trong, định luật Ohm cho toàn mạch, hiện tượng đoản mạch
   dd11-3.4 Ghép nguồn điện nối tiếp, song song, hỗn hợp đối xứng
   dd11-3.5 Bài tập suất điện động, công của nguồn, dung lượng (Ah)
   dd11-3.6 Bài tập định luật Ohm cho toàn mạch
   dd11-3.7 Bài tập đồ thị U – I, I – R, 1/I – R: xác định E, r
   dd11-3.8 Bài tập ghép nguồn điện
   dd11-3.9 Bài tập mạch có tụ điện, mạch có nhiều nguồn
Bài 25: Năng lượng và công suất điện
   dd11-4.1 Năng lượng điện tiêu thụ A = UIt, công tơ điện, kWh
   dd11-4.2 Công suất điện P = UI, công suất định mức
   dd11-4.3 Nhiệt lượng và công suất toả nhiệt trên điện trở (Q = RI²t)
   dd11-4.4 Công, công suất và hiệu suất của nguồn điện
   dd11-4.5 Thực hành đo suất điện động và điện trở trong của pin điện hoá
   dd11-4.6 Bài tập điện năng tiêu thụ, tiền điện
   dd11-4.7 Bài tập công suất, nhiệt lượng trên điện trở, dụng cụ định mức
   dd11-4.8 Bài tập công suất, hiệu suất nguồn điện
   dd11-4.9 Bài tập cực trị công suất (R = r, R1R2 = r²)
   dd11-4.10 Bài tập đồ thị công suất, hiệu suất theo R hoặc I

======================================================================
D. CÂU MẪU VÀ ĐỀ CẦN CHUYỂN
======================================================================
Câu mẫu (macro đúng):
<dán 1 câu mẫu của bạn>

Đề cần chuyển:
<dán đề>
```

## Đổi mã tạm cũ (Vật lí 10) sang mã mới

Các file .tex đã soạn trước với mã tạm cần gắn lại theo bảng của thầy:

| Mã cũ | Mã mới |
|---|---|
| md-1.1 … md-3.2 (cũ, theo bài) | md-1.1 … md-3.3 (md-3.2 cũ = md-3.2 + md-3.3 mới) |
| cd-1.1 (Bài 1.1) | cd-1.1, cd-1.2, cd-1.3 (tuỳ câu) |
| cd-1.2, cd-1.3 (Bài 1.2, 1.3) | cd-2.1 … cd-2.3 |
| cd-2.1, cd-2.2, cd-2.3 | cd-3.1, cd-3.2, cd-3.3 |
| cd-3.1 | cd-4.x |
| cd-4.1 | cd-5.x |
| cd-5.1 | cd-6.x |
| bd-1.1 | bd-1.x |
| bd-2.1 / bd-2.2 / bd-2.3 | bd-2.1 … bd-2.4 / bd-2.5 / bd-2.6 |
| bd-3.1 | bd-3.x |
| bd-4.1 / bd-4.2 / bd-4.3 | bd-4.1 / bd-4.2 / bd-4.3 |
| bd-5.1 / bd-5.2 | bd-5.1 / bd-5.2 |
| bd-ds-cdtbdd / do-thi-vt / gap-nhau | bd-2.1 / bd-2.5 / bd-2.6 |
| bd-ds-roi-tu-do / nem-ngang / nem-xien | bd-3.x / bd-5.1 / bd-5.2 |
| bd-ds-nem-thang-dung / hai-vat / thuc-hanh-g / gia-toc | bd-4.2 / bd-4.3 / bd-4.1 / bd-1.x |
| bd-dlh-tong-hop-luc, bd-dlh-can-bang-luc | dlh-1.x |
| bd-dlh-dl1-newton | dlh-2.x |
| bd-dlh-dl2-newton, bd-dlh-luc-gia-toc | dlh-3.x |
| bd-dlh-dl3-newton | dlh-4.x |
| bd-dlh-trong-luc, bd-dlh-luc-cang | dlh-5.x |
| bd-dlh-luc-ma-sat, *-ma-sat-mpn, *-co-he | dlh-6.x |
| bd-dlh-luc-can, bd-dlh-luc-nang | dlh-7.x |

(Mã có tiền tố -ds- tương ứng cũng đổi theo bảng trên.) Mã cũ có dạng `bd-ds-…`, `bd-dlh-…` không có trong danh mục nên hệ thống sẽ báo "mã không tồn tại" khi nạp đề — cần sửa trong file .tex trước khi nạp.
