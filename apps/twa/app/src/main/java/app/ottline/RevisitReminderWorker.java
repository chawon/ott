package app.ottline;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public final class RevisitReminderWorker extends Worker {

    public RevisitReminderWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParams
    ) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        try {
            RevisitReminderScheduler.syncAutoState(context);
            if (!RevisitReminderScheduler.isEnabled(context)) {
                RevisitReminderScheduler.saveResult(context, "기록 리마인드 꺼짐");
                return Result.success();
            }
            if (!WatchReminderAccess.canPostNotifications(context)) {
                RevisitReminderScheduler.saveResult(context, "알림 권한 없음");
                return Result.success();
            }

            RevisitReminderApiClient.Reminder reminder = RevisitReminderApiClient.fetchNext(context);
            if (reminder == null) {
                RevisitReminderScheduler.saveResult(context, "리마인드 후보 없음");
                return Result.success();
            }
            if (RevisitReminderNotifier.show(context, reminder)) {
                RevisitReminderApiClient.markDelivered(context, reminder.deliveryId);
                RevisitReminderScheduler.saveResult(context, "리마인드 알림 발송: " + reminder.reminderType);
                return Result.success();
            }
            RevisitReminderScheduler.saveResult(context, "리마인드 알림 발송 실패");
            return Result.success();
        } catch (Throwable error) {
            RevisitReminderScheduler.saveResult(
                    context,
                    "리마인드 오류: " + error.getClass().getSimpleName()
            );
            return Result.retry();
        }
    }
}
