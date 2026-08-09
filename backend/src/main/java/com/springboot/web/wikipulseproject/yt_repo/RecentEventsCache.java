package com.springboot.web.wikipulseproject.yt_repo;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;

import java.util.List;
import java.util.Map;

/**
 * Окно свежих правок в памяти.
 * Гарантии и договорённости — docs/03-contracts/backend-cache.md.
 */
public interface RecentEventsCache {

    void put(EnrichedEvent event);

    Map<String, List<EnrichedEvent>> snapshot();
}
