# Hợp đồng dùng chung

`recruitment.ts` định nghĩa request/response cho API vị trí, hồ sơ và phiên đăng nhập, dùng chung giữa frontend và backend. Các type của luồng demo chấm điểm cũ vẫn ở `frontend/src/types/`.

`database.ts` chứa catalog bảng và hợp đồng response của preview database cục bộ. Các cột và policies được backend đọc từ PostgreSQL sau migration; catalog bổ sung tên và giải thích cho giao diện.
