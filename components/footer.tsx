export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-white/50">
      <div className="page-shell grid gap-6 py-10 text-sm text-[var(--ink-soft)] md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="headline-serif text-xl font-bold text-[var(--ink)]">Newsroom Desk</p>
          <p className="mt-3 max-w-2xl leading-7">
            Dashboard này được thiết kế để đọc tin như một “bàn biên tập” cá nhân: bài nào quan trọng lên trước,
            mỗi bài có phần giải thích lại, và luôn có chỗ để hỏi thêm ngay tại chỗ.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <p>Nguồn theo dõi bản v1: VnEconomy, Nghiên cứu Quốc tế</p>
          <p>Phong cách hiển thị: báo chí cao cấp, typography đậm, nhịp dàn trang kiểu long-form newsroom</p>
          <p>Triết lý vận hành: nhẹ, rõ, không nuôi một tab chat quá dài</p>
        </div>
      </div>
    </footer>
  );
}
