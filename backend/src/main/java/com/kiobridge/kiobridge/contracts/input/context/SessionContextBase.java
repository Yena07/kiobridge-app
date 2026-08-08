package com.kiobridge.kiobridge.contracts.input.context;

import java.util.Map;

public interface SessionContextBase<F, P, H, C> {

    SessionIntent intent();

    F facts();

    P preferences();

    H hardConstraints();

    C capabilities();

    Map<String, FieldMetadata> fieldMetadata();
}