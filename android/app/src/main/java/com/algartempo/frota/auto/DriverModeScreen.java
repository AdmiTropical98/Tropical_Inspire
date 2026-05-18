package com.algartempo.frota.auto;

import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarText;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

public class DriverModeScreen extends Screen {
    private static final String DEFAULT_NAV_DESTINATION = "Quinta do Lago";
    private static final String OPERATIONS_PHONE = "+351289000000";

    public DriverModeScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        Pane.Builder paneBuilder = new Pane.Builder()
            .addRow(new Row.Builder()
                .setTitle("Serviço atual")
                .addText("Consulte a próxima escala atribuída no modo condutor do telemóvel.")
                .build())
            .addRow(new Row.Builder()
                .setTitle("Próximo destino")
                .addText(DEFAULT_NAV_DESTINATION)
                .build())
            .addRow(new Row.Builder()
                .setTitle("Alertas urgentes")
                .addText(CarText.create("Confirme alterações de serviço e mensagens da operação antes de arrancar."))
                .build())
            .addAction(new Action.Builder()
                .setTitle("Navegar")
                .setOnClickListener(() -> launchIntent(new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("google.navigation:q=" + Uri.encode(DEFAULT_NAV_DESTINATION))
                ), "Nao foi possivel abrir a navegacao."))
                .build())
            .addAction(new Action.Builder()
                .setTitle("Operações")
                .setOnClickListener(() -> launchIntent(new Intent(
                    Intent.ACTION_DIAL,
                    Uri.parse("tel:" + OPERATIONS_PHONE)
                ), "Nao foi possivel abrir o contacto da operação."))
                .build());

        return new PaneTemplate.Builder(paneBuilder.build())
            .setHeaderAction(Action.APP_ICON)
            .setTitle("Algartempo Frota")
            .setActionStrip(new ActionStrip.Builder()
                .addAction(new Action.Builder()
                    .setTitle("Atualizar")
                    .setOnClickListener(this::invalidate)
                    .build())
                .build())
            .build();
    }

    private void launchIntent(Intent intent, String errorMessage) {
        try {
            getCarContext().startCarApp(intent);
        } catch (RuntimeException exception) {
            CarToast.makeText(getCarContext(), errorMessage, CarToast.LENGTH_SHORT).show();
        }
    }
}