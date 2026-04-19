package com.watchlog.api.repo;

import com.watchlog.api.domain.ChatGptAuthorizationCodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatGptAuthorizationCodeRepository extends JpaRepository<ChatGptAuthorizationCodeEntity, String> {
}
