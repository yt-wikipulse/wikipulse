package tech.wikipulse.backend.repository;

import tech.wikipulse.backend.model.EnrichedEvent;

import java.util.List;
import java.util.Map;

public interface RecentEventsCache {

    void put(EnrichedEvent event);

    Map<String, List<EnrichedEvent>> snapshot();
}
