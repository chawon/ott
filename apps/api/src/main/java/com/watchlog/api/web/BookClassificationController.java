package com.watchlog.api.web;

import com.watchlog.api.dto.ResolveBookClassificationsRequest;
import com.watchlog.api.dto.ResolveBookClassificationsResponse;
import com.watchlog.api.service.BookClassificationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/titles/book-classifications")
public class BookClassificationController {

    private final BookClassificationService service;

    public BookClassificationController(BookClassificationService service) {
        this.service = service;
    }

    @PostMapping("/resolve")
    public ResolveBookClassificationsResponse resolve(
            @RequestBody ResolveBookClassificationsRequest request
    ) {
        return new ResolveBookClassificationsResponse(
                service.resolve(request == null ? null : request.isbn13s())
        );
    }
}
