import { ArticleRecord, DailyDigest } from "@/lib/types";

export const mockArticles: ArticleRecord[] = [
  {
    id: "demo-1",
    slug: "thue-quoc-te-va-suc-ep-chuoi-cung-ung",
    source: "vneconomy",
    sourceLabel: "VnEconomy",
    url: "https://example.com/demo-1",
    title: "Thuế đối ứng mới và sức ép lên chuỗi cung ứng: Doanh nghiệp Việt cần đổi cách đọc thị trường",
    excerpt:
      "Bài viết phân tích vì sao thay đổi thuế ở các nền kinh tế lớn không chỉ là chuyện xuất khẩu, mà còn kéo theo áp lực logistics, hợp đồng và dòng tiền.",
    content:
      "Các doanh nghiệp Việt đang đứng trước một giai đoạn mà chính sách thuế của các thị trường lớn tác động trực tiếp đến lựa chọn khách hàng, tuyến vận chuyển và cấu trúc chi phí. Nếu chỉ nhìn vào thuế suất cuối cùng, doanh nghiệp sẽ bỏ sót những tác động lan sang giao hàng, thanh toán và đàm phán hợp đồng. Điều đáng chú ý là áp lực lớn nhất thường không xuất hiện ngay ở ngày chính sách được công bố, mà ở giai đoạn khách mua bắt đầu tái cơ cấu đơn hàng, siết tồn kho, hoặc ép lại điều khoản giao nhận. Với các ngành phụ thuộc vào biên lợi nhuận mỏng, phần rủi ro đáng sợ không nằm ở một cú sốc đơn lẻ mà nằm ở việc nhiều chi phí nhỏ tăng cùng lúc. Điều đó buộc doanh nghiệp phải theo dõi thị trường theo logic chuỗi cung ứng, thay vì chỉ theo logic thương mại đơn thuần.",
    imageUrl: "/editorial-hero-1.svg",
    publishedAt: "2026-04-15T05:40:00+07:00",
    articleType: "news_analysis",
    importanceLevel: "high",
    importanceScore: 92,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Chính sách thuế mới tạo sức ép lan rộng từ giá bán sang logistics, thanh toán và đàm phán hợp đồng.",
      whatItReallySays:
        "Điểm cốt lõi không phải là thuế tăng bao nhiêu, mà là doanh nghiệp phải đổi cách quản trị rủi ro thương mại theo chuỗi cung ứng.",
      whyItMatters:
        "Các ngành xuất khẩu của Việt Nam dễ bị bào mòn lợi nhuận nếu chỉ phản ứng ở mức giá mà không kiểm soát giao hàng và điều khoản thanh toán.",
      easyExplanation:
        "Nói dễ hiểu, thuế chỉ là phát súng đầu tiên. Sau đó là hàng loạt hệ quả như khách mua trì hoãn, đổi tuyến hàng, ép giá và kéo dài thời gian trả tiền.",
      keyTakeaway:
        "Giữ thị trường nhưng phải đọc lại hợp đồng, tuyến vận tải và lịch thu tiền.",
      cautionNote:
        "Không nên vội kết luận đơn hàng hiện tại còn ổn nghĩa là rủi ro đã qua.",
      conclusionText:
        "Doanh nghiệp nên coi đây là bài toán vận hành và dòng tiền, không chỉ là bài toán giá bán.",
      diagramHint: "cause-effect"
    }
  },
  {
    id: "demo-2",
    slug: "trung-dong-va-bai-toan-bao-hiem-hang-hai",
    source: "vneconomy",
    sourceLabel: "VnEconomy",
    url: "https://example.com/demo-2",
    title: "Biến động Trung Đông đang làm thay đổi cách tính chi phí bảo hiểm hàng hải",
    excerpt:
      "Chi phí vận tải không chỉ tăng ở cước tàu, mà còn phản ánh vào bảo hiểm, phụ phí rủi ro và cách doanh nghiệp chốt điều khoản giao hàng.",
    content:
      "Khi xung đột làm tăng rủi ro đi qua các tuyến vận tải trọng yếu, doanh nghiệp thường nhận ra rất muộn rằng cước tàu chỉ là một phần của tổng chi phí. Phần khó thấy hơn là bảo hiểm, phụ phí chiến tranh, thay đổi cảng đến và chi phí phát sinh do hàng bị chậm. Trong bối cảnh đó, bên mua và bên bán sẽ tranh cãi nhiều hơn về việc ai gánh phần chi phí bổ sung. Điều này khiến các điều khoản Incoterms, bảo hiểm và bất khả kháng trở thành điểm cần đọc kỹ hơn bình thường.",
    imageUrl: "/editorial-secondary-1.svg",
    publishedAt: "2026-04-15T04:15:00+07:00",
    articleType: "news_analysis",
    importanceLevel: "high",
    importanceScore: 87,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Biến động địa chính trị đang đẩy thêm chi phí vô hình vào vận tải biển và hợp đồng thương mại.",
      whatItReallySays:
        "Bài viết muốn nhấn rằng doanh nghiệp phải nhìn tổng chi phí landed cost, không chỉ nhìn cước tàu.",
      whyItMatters:
        "Nếu đọc sai cấu trúc chi phí, doanh nghiệp sẽ tưởng biên lợi nhuận còn an toàn trong khi thực tế đã bị ăn mòn.",
      easyExplanation:
        "Một container không chỉ đắt hơn vì giá vận chuyển tăng, mà còn vì bảo hiểm và phụ phí rủi ro tăng theo.",
      keyTakeaway:
        "Cần rà lại hợp đồng giao nhận, bảo hiểm và phương án đổi tuyến.",
      cautionNote:
        "Các khoản tăng nhỏ cộng lại có thể tạo ra cú sốc lợi nhuận lớn hơn tưởng tượng.",
      conclusionText:
        "Đọc chiến sự bằng ngôn ngữ hợp đồng và chi phí sẽ thực tế hơn đọc theo tiêu đề thời sự.",
      diagramHint: "timeline"
    }
  },
  {
    id: "demo-3",
    slug: "hoi-ket-chien-tranh-va-cau-hoi-endgame",
    source: "nghiencuuquocte",
    sourceLabel: "Nghiên cứu Quốc tế",
    url: "https://example.com/demo-3",
    title: "Hồi kết chiến tranh và câu hỏi endgame: Thắng chiến thuật chưa chắc thắng chiến lược",
    excerpt:
      "Một bài bình luận chiến lược nhấn mạnh khoảng cách giữa thành công quân sự ngắn hạn và mục tiêu chính trị dài hạn.",
    content:
      "Bài bình luận đặt ra câu hỏi rất cơ bản nhưng thường bị bỏ qua trong chiến tranh hiện đại: đánh để làm gì và khi nào thì được coi là xong. Tác giả cho rằng nếu mục tiêu chính trị cuối cùng không rõ, chiến thắng chiến thuật ban đầu có thể rất nhanh chuyển thành một chuỗi nghĩa vụ mới: ổn định hậu chiến, kiểm soát leo thang, xử lý khoảng trống quyền lực và quản trị chi phí dài hạn. Lập luận trung tâm ở đây là chiến tranh không thể tự định nghĩa mục tiêu của nó. Một khi ngôn ngữ chính trị mơ hồ, lực lượng quân sự càng thắng nhanh thì áp lực xác định endgame lại càng lớn.",
    imageUrl: "/editorial-hero-2.svg",
    publishedAt: "2026-04-15T01:20:00+07:00",
    articleType: "opinion_translation",
    importanceLevel: "high",
    importanceScore: 90,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Bài bình luận lập luận rằng chiến thắng quân sự không tự động tạo ra một kết thúc chính trị khả thi.",
      whatItReallySays:
        "Điểm trọng tâm là rủi ro sa lầy chiến lược nếu không xác định rõ mục tiêu cuối cùng của cuộc chiến.",
      whyItMatters:
        "Đây là cách đọc giúp tách phần sự kiện khỏi phần lập luận và tránh hiểu nhầm bài bình luận như bản tin fact thuần.",
      easyExplanation:
        "Nói đơn giản, bài này hỏi: đánh xong rồi làm gì tiếp. Nếu không trả lời được, chiến tranh rất dễ kéo dài.",
      keyTakeaway:
        "Phải phân biệt chiến thắng tác chiến với kết thúc chính trị.",
      cautionNote:
        "Đây là bài bình luận chiến lược nên cần đọc cùng ý thức rằng tác giả đang đưa ra lập luận, không phải phán quyết cuối cùng.",
      conclusionText:
        "Giá trị lớn nhất của bài nằm ở việc buộc người đọc quay lại câu hỏi mục tiêu chính trị.",
      diagramHint: "cause-effect"
    }
  },
  {
    id: "demo-4",
    slug: "viet-nam-va-the-can-bang-dia-chinh-tri-moi",
    source: "nghiencuuquocte",
    sourceLabel: "Nghiên cứu Quốc tế",
    url: "https://example.com/demo-4",
    title: "Việt Nam trước thế cân bằng địa chính trị mới: Không chỉ là đối ngoại, mà còn là kinh tế",
    excerpt:
      "Bài phân tích cho thấy thay đổi trong cấu trúc quyền lực khu vực sẽ dần đi vào dòng vốn, chuỗi cung ứng và lựa chọn chính sách của Việt Nam.",
    content:
      "Phân tích nhấn mạnh rằng địa chính trị không đứng bên ngoài kinh tế. Khi các cường quốc tái cấu trúc liên minh, chuỗi cung ứng và công nghệ, các nước trung bình như Việt Nam phải phản ứng không chỉ ở ngôn ngữ đối ngoại mà còn ở đầu tư, pháp lý và năng lực sản xuất. Nói cách khác, thế cân bằng mới không chỉ là chuyện phát biểu mềm dẻo trên bàn ngoại giao, mà là bài toán về tiêu chuẩn, đối tác công nghệ, độ mở thị trường và mức độ tự chủ chính sách.",
    imageUrl: "/editorial-secondary-2.svg",
    publishedAt: "2026-04-14T20:10:00+07:00",
    articleType: "opinion_translation",
    importanceLevel: "medium",
    importanceScore: 76,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Địa chính trị mới sẽ đi vào kinh tế qua công nghệ, đầu tư, chuỗi cung ứng và tiêu chuẩn thị trường.",
      whatItReallySays:
        "Bài muốn nói rằng Việt Nam không thể tách đối ngoại khỏi năng lực kinh tế thực chất.",
      whyItMatters:
        "Cách đọc này hữu ích vì nó nối được chính trị quốc tế với quyết định của doanh nghiệp và nhà nước.",
      easyExplanation:
        "Tức là không chỉ giữ quan hệ tốt là đủ; còn phải biết mình sản xuất gì, dùng công nghệ nào và phụ thuộc vào ai.",
      keyTakeaway:
        "Khả năng thích nghi kinh tế sẽ quyết định mức độ linh hoạt đối ngoại.",
      cautionNote:
        "Lập luận thiên về khung chiến lược nên cần kiểm tra thêm dữ liệu nếu muốn dùng cho quyết định cụ thể.",
      conclusionText:
        "Bài nên được đọc như một cảnh báo về năng lực nội tại, không chỉ như một bình luận đối ngoại.",
      diagramHint: "compare"
    }
  },
  {
    id: "demo-5",
    slug: "hoi-cho-thuong-mai-va-dong-tin-co-gia-tri",
    source: "vneconomy",
    sourceLabel: "VnEconomy",
    url: "https://example.com/demo-5",
    title: "Một hội chợ thương mại khi nào đáng đọc: Phân biệt tin xúc tiến với quảng cáo thuần",
    excerpt:
      "Không phải mọi bài xúc tiến đều nên bỏ. Một số bài chứa tín hiệu thị trường, chuỗi cung ứng và cơ hội ngành đáng theo dõi.",
    content:
      "Nhiều bài về hội chợ, triển lãm, diễn đàn xúc tiến thường bị xếp ngay vào nhóm quảng bá. Tuy nhiên, nếu bài viết cung cấp dữ liệu về ngành, xu hướng mua hàng, thị trường đích hoặc định hướng chính sách hỗ trợ, nó vẫn có giá trị thông tin. Vấn đề là phải tách phần mời gọi tham gia sự kiện khỏi phần tín hiệu thị trường thực sự hữu ích.",
    imageUrl: "/editorial-secondary-3.svg",
    publishedAt: "2026-04-14T16:45:00+07:00",
    articleType: "news_analysis",
    importanceLevel: "medium",
    importanceScore: 61,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Tin xúc tiến không phải lúc nào cũng vô giá trị; có bài vẫn đáng giữ vì chứa tín hiệu thị trường.",
      whatItReallySays:
        "Bộ lọc đúng là giữ những bài giúp hiểu cơ hội ngành và loại bài chỉ mang tính mời chào.",
      whyItMatters:
        "Điều này phù hợp với cách bạn muốn hệ thống bỏ quảng cáo thuần nhưng vẫn giữ bài xúc tiến hữu ích.",
      easyExplanation:
        "Nghĩa là không nên loại hết theo cảm tính; phải xem bài đó cho bạn biết thêm điều gì ngoài việc mời tham gia.",
      keyTakeaway:
        "Giá trị thông tin quyết định việc giữ hay bỏ bài xúc tiến.",
      cautionNote:
        "Cần đánh dấu rõ đây là bài xúc tiến để tránh nhầm với tin phân tích độc lập.",
      conclusionText:
        "Một bộ lọc tinh sẽ tốt hơn việc chặn thô toàn bộ bài truyền thông.",
      diagramHint: "none"
    }
  },
  {
    id: "demo-6",
    slug: "dong-tien-va-do-tre-chinh-sach",
    source: "vneconomy",
    sourceLabel: "VnEconomy",
    url: "https://example.com/demo-6",
    title: "Dòng tiền thường phản ứng trước khi chính sách ngấm: Cách đọc một giai đoạn chuyển tiếp",
    excerpt:
      "Phân tích này giải thích vì sao thị trường đôi khi phản ứng sớm hơn tăng trưởng thực và khiến người đọc tin dễ hiểu sai.",
    content:
      "Trong các giai đoạn chuyển tiếp, thị trường tài chính thường phản ứng trước nền kinh tế thực vì nhà đầu tư định giá kỳ vọng tương lai. Điều này khiến nhiều người đọc nhầm rằng chính sách đã phát huy hiệu quả tức thì, trong khi doanh nghiệp và hộ gia đình có thể vẫn chưa cảm nhận được nhiều. Khoảng trễ giữa kỳ vọng thị trường và chuyển động kinh tế thực là điều cần được giải thích rõ nếu muốn đọc tin theo hướng thực chất hơn.",
    imageUrl: "/editorial-secondary-4.svg",
    publishedAt: "2026-04-14T13:20:00+07:00",
    articleType: "news_analysis",
    importanceLevel: "low",
    importanceScore: 48,
    keepArticle: true,
    isPromotional: false,
    summary: {
      summaryShort:
        "Thị trường phản ứng sớm theo kỳ vọng nên không phải lúc nào cũng phản ánh ngay thực trạng kinh tế thực.",
      whatItReallySays:
        "Bài muốn nhắc người đọc phân biệt tín hiệu thị trường với hiệu quả chính sách đã ngấm vào nền kinh tế.",
      whyItMatters:
        "Nếu đọc sai nhịp này, bạn sẽ dễ đánh giá quá sớm về tác động của chính sách.",
      easyExplanation:
        "Cổ phiếu hoặc trái phiếu có thể tăng vì người ta tin tương lai sẽ tốt hơn, không phải vì hiện tại đã tốt lên.",
      keyTakeaway:
        "Đọc thị trường là đọc kỳ vọng; đọc doanh nghiệp là đọc độ trễ.",
      cautionNote:
        "Không nên dùng phản ứng giá ngắn hạn để kết luận thay cho dữ liệu nền kinh tế thực.",
      conclusionText:
        "Bài này hữu ích như một khung giải thích hơn là một tin nóng đơn lẻ.",
      diagramHint: "timeline"
    }
  }
];

export const mockDigest: DailyDigest = {
  date: "2026-04-15",
  title: "Morning Edition | Thuế, chuỗi cung ứng và rủi ro chiến lược",
  intro:
    "Bản tin sáng hôm nay xoay quanh một trục lớn: chi phí thương mại quốc tế đang chịu sức ép từ cả chính sách thuế lẫn bất ổn địa chính trị. Ở chiều còn lại, nhóm bài bình luận cho thấy chiến thắng quân sự hay ngoại giao chỉ có ý nghĩa khi gắn với endgame và năng lực kinh tế thực chất.",
  articleSlugs: [
    "thue-quoc-te-va-suc-ep-chuoi-cung-ung",
    "trung-dong-va-bai-toan-bao-hiem-hang-hai",
    "hoi-ket-chien-tranh-va-cau-hoi-endgame"
  ]
};
