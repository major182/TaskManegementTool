package com.example.taskboard;

import org.springframework.boot.SpringApplication;

public class TestTaskboardApplication {

    public static void main(String[] args) {
        SpringApplication.from(TaskboardApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
