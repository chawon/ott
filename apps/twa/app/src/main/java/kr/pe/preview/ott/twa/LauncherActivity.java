/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package kr.pe.preview.ott.twa;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    static final String EXTRA_QUICK_TYPE = "quick_type";
    static final String QUICK_TYPE_VIDEO = "video";
    static final String QUICK_TYPE_BOOK = "book";
    static final String QUICK_TYPE_TIMELINE = "timeline";


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        Intent intent = getIntent();
        if (intent == null) return uri;

        String quickType = intent.getStringExtra(EXTRA_QUICK_TYPE);
        if (!TextUtils.isEmpty(quickType)) {
            if (QUICK_TYPE_TIMELINE.equals(quickType)) {
                return uri.buildUpon().path("/timeline").build();
            }
            if (QUICK_TYPE_VIDEO.equals(quickType) || QUICK_TYPE_BOOK.equals(quickType)) {
                return uri.buildUpon()
                        .appendQueryParameter("quick", "1")
                        .appendQueryParameter("quick_type", quickType)
                        .appendQueryParameter("quick_focus", "1")
                        .build();
            }
        }

        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            String sharedMime = intent.getType();

            if (sharedText != null && !sharedText.isBlank()) {
                Uri.Builder builder = uri.buildUpon();
                builder.appendQueryParameter("shared_text", sharedText);
                if (sharedSubject != null && !sharedSubject.isBlank()) {
                    builder.appendQueryParameter("shared_subject", sharedSubject);
                }
                if (sharedMime != null && !sharedMime.isBlank()) {
                    builder.appendQueryParameter("shared_mime", sharedMime);
                }
                return builder.build();
            }
        }

        return uri;
    }
}
