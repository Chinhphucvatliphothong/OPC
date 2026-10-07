# Prompt gắn tag nano-point – Vật lí 12 (4 chương SGK)

Bản đồng bộ với `nano-map.js` ngày 06/10/2026 (danh sách cập nhật lần 2 của thầy: 101 nano-point).

Cách dùng: copy nguyên khối trong ba dấu ``` bên dưới, dán vào Claude, thay phần C ở cuối bằng câu mẫu và đề cần chuyển.

```
Chuyển đề Vật lí 12 dưới đây sang LaTeX (gói ex_test) và gắn tag nano-point.

ĐỊNH DẠNG BẮT BUỘC cho mỗi câu:
%Câu <số>
% [<M1|M2|M3|M4>][<tên chủ đề>][<tên bài>]
% @nano: <mã nano chính>[, <mã phụ>[, <mã phụ>]]
\begin{ex}
  ...
\end{ex}

======================================================================
A. QUY TẮC CHUNG
======================================================================
1. Ngoặc 2 (tên chủ đề) chỉ được là MỘT trong 4 chuỗi sau, chép y hệt:
   Vật lí nhiệt | Khí lí tưởng | Từ trường | Vật lí hạt nhân
2. Ngoặc 3 (tên bài) chép NGUYÊN VĂN tên bài ở mục B, kể cả "Bài n:" và dấu chấm.
   Dấu gạch ngang trong tên bài (vd. Bài 3, Bài 20) dùng "–" như ở mục B.
3. Mã nano chỉ được chọn trong mục B. Mã, bài và chủ đề phải khớp nhau
   (mã nhiet-… đi với Vật lí nhiệt, khi-… với Khí lí tưởng,
    tt-… với Từ trường, hn-… với Vật lí hạt nhân).
4. Chọn theo KIẾN THỨC câu hỏi kiểm tra, không theo từ khoá xuất hiện.
5. Nano có chữ "Bài tập", "Đồ thị", "Thực hành", "Thí nghiệm" chỉ dùng khi câu đúng dạng đó; câu thuần lí thuyết
   dùng nano "Lý thuyết"/khái niệm của bài tương ứng.
6. Câu dùng nhiều kiến thức (thường là đề thi thử của trường/sở): ghi tối đa 3 mã,
   mã chính (kiến thức quyết định đúng/sai) đứng đầu; các mã có thể thuộc các bài
   hoặc chủ đề khác nhau. Ngoặc 2 và ngoặc 3 lấy theo mã chính.
7. Mức độ: M1 nhận biết, M2 thông hiểu, M3 vận dụng, M4 vận dụng cao.
8. Giữ nguyên nội dung, số liệu, đáp án gốc. Không tự sửa đề.
   Có lời giải thì đưa vào \loigiai{}, không có thì để trống, không tự bịa.
   Dùng đúng macro như câu mẫu tôi dán ở cuối.
9. Sau khi xong, lập bảng: Câu | Mức | Mã nano | Lí do chọn (1 dòng),
   và đánh dấu (?) những câu phân vân giữa 2 mã để tôi tự quyết.

======================================================================
B. DANH MỤC BÀI VÀ NANO-POINT
======================================================================

---------------- B1. Vật lí nhiệt ----------------
Bài 1: Cấu trúc của chất. Sự chuyển thể
   nhiet-1.1 Cấu trúc của chất
   nhiet-1.2 Sự chuyển thể
   nhiet-1.3 Đồ thị cấu trúc của chất - Sự chuyển thể
   nhiet-1.4 Bài tập cấu trúc và sự chuyển thể
Bài 2: Nội năng. Định luật I của nhiệt động lực học
   nhiet-2.1 Khái niệm nội năng, cách làm thay đổi nội năng
   nhiet-2.2 Định luật I Nhiệt động lực học
   nhiet-2.3 Thí nghiệm sự truyền nhiệt
   nhiet-2.4 Bài tập Nội năng - Định luật I nhiệt động lực học
   nhiet-2.5 Lực tương tác - thế năng phân tử
Bài 3: Nhiệt độ. Thang nhiệt độ – nhiệt kế
   nhiet-3.1 Thang nhiệt độ
   nhiet-3.2 Nhiệt kế
   nhiet-3.3 Bài tập nhiệt kế - Thang nhiệt độ
Bài 4: Nhiệt dung riêng
   nhiet-4.1 Lý thuyết nhiệt dung riêng
   nhiet-4.2 Thực hành đo nhiệt dung riêng
   nhiet-4.3 Bài tập tính nhiệt dung riêng
   nhiet-4.4 Bài toán đun nước - Bình nước nóng năng lượng mặt trời
   nhiet-4.5 Bài tập phương trình cân bằng nhiệt
   nhiet-4.6 Đồ thị nhiệt dung riêng
Bài 5: Nhiệt nóng chảy riêng
   nhiet-5.1 Lý thuyết nhiệt nóng chảy riêng
   nhiet-5.2 Bài tập nhiệt nóng chảy
   nhiet-5.3 Đồ thị nhiệt nóng chảy riêng
   nhiet-5.4 Thực hành nhiệt nóng chảy riêng
Bài 6: Nhiệt hoá hơi riêng
   nhiet-6.1 Lý thuyết nhiệt hóa hơi
   nhiet-6.2 Bài tập nhiệt hóa hơi
   nhiet-6.3 Đồ thị nhiệt hoá hơi riêng
   nhiet-6.4 Thực hành nhiệt hóa hơi riêng
Bài 7: Động cơ nhiệt - Năng suất tỏa nhiệt của nhiên liệu
   nhiet-7.1 Bài tập Động cơ nhiệt - Năng suất tỏa nhiệt của nhiên liệu

---------------- B2. Khí lí tưởng ----------------
Bài 8: Mô hình động học phân tử chất khí
   khi-1.1 Chuyển động Brown
   khi-1.2 Mô hình động học phân tử – Thuyết động học phân tử
   khi-1.3 Bài tập lượng chất - chuyển động phân tử
   khi-1.4 Bài tập áp suất chất khí
Bài 9: Định luật Boyle
   khi-2.1 Lý thuyết định luật Boyle
   khi-2.2 Đồ thị đường đẳng nhiệt
   khi-2.3 Bài tập quá trình đẳng nhiệt
   khi-2.4 Xác định số lần bơm
   khi-2.5 Cân bằng pit-tông
   khi-2.6 Nguyên lý Pascal
   khi-2.7 Thí nghiệm định luật Boyle
Bài 10: Định luật Charles
   khi-3.1 Lý thuyết quá trình đẳng áp đẳng tích
   khi-3.2 Bài tập quá trình đẳng áp
   khi-3.3 Bài tập quá trình đẳng tích
   khi-3.4 Định luật Dalton – khí đa quá trình
Bài 11: Phương trình trạng thái của khí lí tưởng
   khi-4.1 Lý thuyết phương trình trạng thái khí lí tưởng
   khi-4.2 Bài tập phương trình trạng thái khí lí tưởng
   khi-4.3 Bài tập phương trình Clapeyron và Van der Waals
   khi-4.4 Bài tập Phương trình Mendeleev với khối lượng riêng
   khi-4.5 Bài tập hỗn hợp khí
   khi-4.6 Đồ thị trạng thái khí lí tưởng
Bài 12: Áp suất khí theo mô hình động học phân tử
   khi-5.1 Lý thuyết Áp suất khí theo mô hình động học phân tử
   khi-5.2 Lý thuyết Quan hệ giữa động năng phân tử và nhiệt độ
   khi-5.3 Bài tập Áp suất động năng phân tử
Bài 13: Nội năng của khối khí
   khi-6.1 Lý thuyết nội năng của khí lí tưởng
   khi-6.2 Áp dụng định luật I nhiệt động lực học
   khi-6.3 Bài tập Áp dụng định luật I nhiệt động lực học
   khi-6.4 Đồ thị nhiệt động lực học của khối khí lí tưởng

---------------- B3. Từ trường ----------------
Bài 14: Từ trường
   tt-1.1 Tương tác từ
   tt-1.2 Khái niệm từ trường
   tt-1.3 Đường sức từ
   tt-1.4 Quy tắc xác định chiều cảm ứng từ, lực từ
   tt-1.5 Bài tập từ trường dòng điện thẳng, dòng điện tròn, dòng điện trong ống dây
Bài 15: Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ
   tt-2.1 Lực từ tác dụng lên đoạn dây dẫn mang dòng điện, quy tắc bàn tay trái
   tt-2.2 Cảm ứng từ
   tt-2.3 Tương tác giữa hai dòng điện thẳng song song
   tt-2.4 Momen ngẫu lực từ tác dụng lên khung dây
   tt-2.5 Chuyển động của hạt mang điện trong từ trường. Lực Lorentz
   tt-2.6 Máy quang phổ kế và máy gia tốc
   tt-2.7 Thực hành đo độ lớn cảm ứng từ
Bài 16: Từ thông. Hiện tượng cảm ứng điện từ
   tt-3.1 Lý thuyết Từ Thông. Hiện tượng cảm ứng điện từ
   tt-3.2 Bài tập Từ Thông. Hiện tượng cảm ứng điện từ
   tt-3.3 Bài tập Suất điện động cảm ứng
   tt-3.4 Đồ thị suất điện động cảm ứng
   tt-3.5 Đoạn dây dẫn chuyển động từ trường
   tt-3.6 Máy phát điện đĩa Faraday
Bài 17: Máy phát điện xoay chiều
   tt-4.1 Lý thuyết Máy phát điện xoay chiều
   tt-4.2 Lý thuyết đại cương về dòng điện xoay chiều
   tt-4.3 Bài tập máy phát điện xoay chiều
   tt-4.4 Bài tập đại cương dòng điện xoay chiều
Bài 18: Ứng dụng hiện tượng cảm ứng điện từ
   tt-5.1 Lý thuyết ứng dụng hiện tượng cảm ứng (bếp từ, phanh điện từ, loa điện động, dòng điện Foucault)
   tt-5.2 Bài tập Ứng dụng Hiện tượng cảm ứng điện từ
   tt-5.3 Ứng dụng Lưu lượng kế điện tử và máy phát điện từ thủy động
Bài 19: Điện từ trường. Mô hình sóng điện từ
   tt-6.1 Lý thuyết định tính điện từ trường, mô hình sóng điện từ
   tt-6.2 Bài tập điện từ trường, mô hình sóng điện từ
Bài 20: Truyền tải điện năng – Máy biến áp
   tt-7.1 Lý thuyết truyền tải điện năng - máy biến áp
   tt-7.2 Bài tập Truyền tải điện năng - máy biến áp

---------------- B4. Vật lí hạt nhân ----------------
Bài 21: Cấu trúc hạt nhân
   hn-1.1 Mô hình nguyên tử
   hn-1.2 Cấu trúc hạt nhân
   hn-1.3 Bài tập Cấu trúc hạt nhân. Mô hình nguyên tử
   hn-1.4 Thí nghiệm tán xạ alpha
Bài 22: Phản ứng hạt nhân và năng lượng liên kết
   hn-2.1 Năng lượng liên kết hạt nhân
   hn-2.2 Bài tập hệ thức Einstein. Năng lượng liên kết hạt nhân
   hn-2.3 Phản ứng phân hạch, nhiệt hạch
   hn-2.4 Bài tập phản ứng hạt nhân, phân hạch, nhiệt hạch
Bài 23: Hiện tượng phóng xạ
   hn-3.1 Lý thuyết hiện tượng phóng xạ
   hn-3.2 Bài tập hiện tượng phóng xạ
   hn-3.3 Quy luật phóng xạ
   hn-3.4 Bài tập độ phóng xạ
Bài 24: Công nghiệp hạt nhân. An toàn phóng xạ
   hn-4.1 Công nghệ hạt nhân
   hn-4.2 An toàn phóng xạ
   hn-4.3 Ứng dụng của vật lí hạt nhân
   hn-4.4 Bài tập Ứng dụng của vật lí hạt nhân
   hn-4.5 Đồ thị hạt nhân nguyên tử

======================================================================
C. CÂU MẪU VÀ ĐỀ CẦN CHUYỂN
======================================================================
Câu mẫu (macro đúng):
<dán 1 câu mẫu của bạn>

Đề cần chuyển:
<dán đề>
```
