package com.springboot.web.wikipulseproject.store;

import com.github.benmanes.caffeine.cache.Cache;
import com.springboot.web.wikipulseproject.model.EnrichedEdit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;

/**
 * Единственная точка, которая знает, КАК хранить события в кэше
 * (ключ = event_id). Сервисы и поллер работают только через него.
 */
@Component
@RequiredArgsConstructor
public class RecentEditsStore {

    private final Cache<String, EnrichedEdit> cache;

    /** Положить событие. Повторный event_id перезапишет старое — дублей не будет. */
    public void add(EnrichedEdit edit) {
        cache.put(edit.eventId(), edit);
    }

    /** Отдать все события, которые сейчас живы (не протухли по TTL). */
    public Collection<EnrichedEdit> snapshot() {
        return cache.asMap().values();
    }
}
