# Room & WorkManager reflection constructors (critical for R8 / Android 16+)
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }
-keep class * extends androidx.work.CoroutineWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep class * extends androidx.work.Worker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses @kotlinx.serialization.Serializable class app.ottline.** { *; }
-keep,includedescriptorclasses class app.ottline.**$$serializer { *; }
-keepclassmembers enum app.ottline.** { *; }
-keepclassmembers class app.ottline.** {
    *** Companion;
}
-keepclasseswithmembers class app.ottline.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**

# Google Play In-App Review
-dontwarn com.google.android.play.core.**
