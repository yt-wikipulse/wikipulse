package com.springboot.web.wikipulseproject.yt_repo;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;

/** Событие вместе с моментом попадания в кэш — по нему считается окно. */
record TimedEvent(EnrichedEvent event, long addedAtMillis) {
}
